/**
 *
 * The MIT License (MIT)
 *
 * https://www.flowchain.co
 *
 * Copyright (c) 2016-present Jollen
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

'use strict';

var ChordUtils = require('./utils');
require('console.table');

// Chord protocols
var Chord = require('./message');

function Node(id, server) {
    this.id = id;
    this.address = server.host;
    this.port = server.port;

    this.server = server;

    // Each node can keep a finger table containing up to 'm' entries
    // Default is 32 entries
    this.finger_entries = 8;
    this.ttl = 6;

    // Default successor is self
    this._self = {
        address: this.address,
        port: this.port,
        id: this.id
    };

    // Create a new Chord ring
    this.predecessor = this._self;
    this.successor = this._self;

    // Initialize finger table
    this.fingers = [];
    this.fingers.length = 0;

    this.next_finger = 0;
    this.join_confirms = 0;
    this.join_denies = 0;

    // TTL of predecessor
    this.predecessor_ttl = this.ttl;
    this.successor_ttl = this.ttl;

    console.info('node id = '+ this.id);
    console.info('successor = ' + JSON.stringify(this.successor));

    this._startUpdateFingers();
};

/*
 * Fix finger table entries.
 */
Node.prototype._startUpdateFingers = function() {
    var fix_fingers = function() {
        var fixFingerId = '';
        var next = this.next_finger;


        if (next >= this.finger_entries) {
            console.log('set next to 0');
            next = 0;
        }

        fixFingerId = ChordUtils.getFixFingerId(this.id, next);
        this.next_finger = next + 1;

        if (ChordUtils.DebugFixFingers) {
            console.info('getFixFingerId = ' + fixFingerId);
            console.info('finger table length = '+ this.fingers.length);
        }

        // n.fix_fingers()
        this.send(this._self, {
            type: Chord.FIND_SUCCESSOR,
            id: fixFingerId,
            next: next
        });

        // Print finger table, predecessor and successor
        if (ChordUtils.DebugPrintFingerTable) {
            

            var dataset = [];
            /*
            for (var i = this.fingers.length - 1; i >= 0; --i) {
                dataset.push({
                    next: i,
                    key: this.fingers[i].key,
                    successor: this.fingers[i].successor.id
                });
            }*/
            //console.table(dataset);

            console.log('----------------------');
            console.log('successor: ' + JSON.stringify(this.successor));
            console.log('predecessor: ' + JSON.stringify(this.predecessor));
            console.log('----------------------');

            // send to debug server
            this.send({
                address: process.env.DEBUGSERVER || 'localhost',
                port: process.env.DEBUGSERVER_PORT || 9000
            }, {
                id: '00000000',
                node: this.id,
                successor: this.successor,
                predecessor: this.predecessor
            });
        }
    };

    // Stabilize
    
    this._stabilize = setInterval(function stabilize() {
        this.send(this.successor, { type: Chord.NOTIFY_STABILIZE });
    }.bind(this), 2500);

    // Failure check
    this._check_predecessor = setInterval(function check_predecessor() {
        if (ChordUtils.DebugFailureCheck) {
            console.log('predecessor_ttl =', this.predecessor_ttl);
        }

        // check predecessor
        if (--this.predecessor_ttl < 1) {
            this.predecessor = null;
            this.predecessor_ttl = this.ttl;
        }

        // checks whether predecessor has failed
        if (this.predecessor !== null)
            this.send(this.predecessor, { type: Chord.CHECK_PREDECESSOR, predecessor_ttl: this.predecessor_ttl });
    }.bind(this), 1500);

    // Failure check
    this._check_successor = setInterval(function check_successor() {
        if (ChordUtils.DebugFailureCheck) {
            console.log('successor_ttl =', this.successor_ttl);
        }

        // check successor
        if (--this.successor_ttl < 1) {
            this.successor = this._self;
            this.successor_ttl = this.ttl;
        }
        this.send(this.successor, { type: Chord.CHECK_SUCESSOR, successor_ttl: this.successor_ttl });
    }.bind(this), 3500);

    this._fix_fingers = setInterval(fix_fingers.bind(this), 5000);
}

Node.prototype.clearIntervals = function() {
    clearInterval(this._fix_fingers);
    clearInterval(this._check_successor);
    clearInterval(this._check_predecessor);
    clearInterval(this._stabilize);
}

/*
 * @param {Object} { address: '127.0.0.1', port: 8000 }
 * @param {Object} { type: 2, id: 'b283326930a8b2baded20bb1cf5b6358' }
 */
Node.prototype.send = function(from, message, to) {
    if (typeof to === 'undefined') {
        to = from;
        from = this._self;
    }

    if (typeof message.id === 'undefined') {
        message.id = this.id;
    }

    //encryptMessage here?
    var packet = {
        from: {
            address: from.address,
            port: from.port,
            id: from.id
        },
        message: message
    };

    return this.server.sendChordMessage(to, packet);
};

/*
 * Save data to successor(key)
 */
Node.prototype.save = function(data) {
    var to = this.successor;
    var from = this._self;
    var key = ChordUtils.hash(data);

    var message = {
        id: key,
        type: Chord.MESSAGE,
        data: data
    };

    this.send(to, message);

    return true;
};

/*
 * Read data of key from successor(key)
 */
Node.prototype.read = function(key) {
    var to = this.successor;
    var from = this._self;

    var message = {
        id: key,
        type: Chord.FIND_SUCCESSOR,
        data: {
            origin: from,
            key: key
        }
    };

    this.send(to, message);

    return true;
};

/*
 * @return {boolean}
 */
Node.prototype.join = function(remote, name, key, signature) {
    //console.log(this.server);
    var message = {
        type: Chord.NOTIFY_JOIN,
        name: name,
        key: key,
        signature: signature
    };

    this.predecessor = null;

    if (ChordUtils.DebugNodeJoin)
        console.info('try to join ' + JSON.stringify(remote));

    // Join
    this.send(remote, message);

    return true;
};

/*
 * Return closet finger proceding ID
 */
Node.prototype.closet_finger_preceding = function(find_id) {
    /*
     * n.closest_preceding_node(id)
     *   for i = m downto 1
     *     if (finger[i]∈(n,id))
     *       return finger[i];
     *   return n;
     */
    for (var i = this.fingers.length - 1; i >= 0; --i) {
        if (this.fingers[i] && ChordUtils.isInRange(this.fingers[i].successor.id, this.id, find_id)) {
            return this.fingers[i].successor;
        }
    }

    if (ChordUtils.isInRange(this.successor.id, this.id, find_id)) {
        return this.successor;
    }

    return this._self;
};

Node.prototype.dispatch = function(_from, _message) {
    var from = _from;
    var message = _message;
    var self = this;

    switch (message.type) {
        // N notifies its successor for predecessor
        case Chord.NOTIFY_STABILIZE:
            /*
             *  n.stabilize()
             *    x = successor.predecessor;
             *    if (x∈(n, successor))
             *      successor = x;
             *    successor.notify(n);
             */
            if (ChordUtils.DebugStabilize)
                console.log('NOTIFY_STABILZE: from =', from.id, ', this =', this.id, ', this.successor =', this.successor.id);

            // N might be our predecessor_ttl
            if (this.predecessor === null) {
                this.predecessor = from;
            }

            // unstabilized
            if (ChordUtils.isInRange(this.predecessor.id, from.id, this.id)) {
                message.type = Chord.NOTIFY_PREDECESSOR;
                return this.send(this.predecessor, message, from);
            }

            message.type = Chord.NOTIFY_SUCCESSOR;
            this.send(from, message, this);

            break;

        case Chord.NOTIFY_PREDECESSOR:
            if (ChordUtils.DebugStabilize)
                console.log('NOTIFY_PREDECESSOR: from =', from.id, ', this =', this.id, ', this.successor =', this.successor.id);
            
            if (ChordUtils.isInRange(from.id, this.id, this.successor.id)) {
                this.successor = from;

                if (ChordUtils.DebugStabilize)
                    console.info('NOTIFY_PREDECESSOR: new successor is now = ' + this.successor.id);
            }

            message.type = Chord.NOTIFY_SUCCESSOR;

            this.send(this, message, this.successor);

            break;

        case Chord.NOTIFY_SUCCESSOR:
            if (ChordUtils.DebugStabilize)
                console.log('NOTIFY_SUCCESSOR: from =', from.id, ', this =', this.id, ', this.successor =', this.successor.id);

            /* n.notify(n')
             *  if (predecessor is nil or n'∈(predecessor, n))
             *     predecessor = n';
             */
            if (this.predecessor === null
                || ChordUtils.isInRange(from.id, this.predecessor.id, this.id)) {
                this.predecessor = from;

                if (ChordUtils.DebugStabilize)
                    console.info('NOTIFY_SUCCESSOR: new predecessor is now = ' + this.predecessor.id);
            }

            break;

        case Chord.FOUND_SUCCESSOR:
            // fix finger table
            if (message.hasOwnProperty('next')) {
                this.fingers[message.next] = {
                    successor: from,
                    key: message.id
                };

                if (ChordUtils.DebugSuccessor)
                    console.info('FOUND_SUCCESSOR = finger table fixed');

            // find successor(key)
            } else if (message.hasOwnProperty('data')) {
                if (ChordUtils.DebugSuccessor)
                    console.info('found successor(key) = ' + message.id);

                message.type = Chord.MESSAGE;
                this.send(this, message, from);

            // find successor
            } else {
                this.successor = from;

                if (ChordUtils.DebugSuccessor)
                    console.info('new successor is now = ' + this.successor.id);
            }

            break;

        case Chord.NOTIFY_JOIN:
            if (ChordUtils.DebugNodeJoin)
                console.info('Node joined: ' + JSON.stringify(from));

            //console.log('from: ', JSON.stringify(from))
            //console.log('notify join message: ', message);
            
            this.server.onjoin(from, message, function(result){
                //add signature verification
                //check database for hash

                if(result == true)
                {
                    self.join_confirms++;
                }else{
                    self.join_denies++;
                }
                //console.log(from);
                //console.log(message);


                message.from = from;
                message.type = Chord.REQUEST_JOIN;
                self.send(self.successor, message);
                self.send(self.predecessor, message);
            });
            

            break;

        case Chord.REQUEST_JOIN:

            //console.log('got request');
            var joiner = message.from;
            this.server.onjoin(joiner, message, function(result){

                //console.log(result);
                if(result == true){
                    message.type = Chord.CONFIRM_JOIN;
                }else{
                    message.type = Chord.DENY_JOIN;
                }
                self.send(from, message);
            });

            break;

        case Chord.CONFIRM_JOIN:
        case Chord.DENY_JOIN:

            if(message.type == Chord.CONFIRM_JOIN){
                //console.log('got confirm');
                this.join_confirms++;
            }else if(message.type == Chord.DENY_JOIN){
                //console.log('got deny')
                this.join_denies++;
            }
            //console.log('confirms: ', this.join_confirms);
            //console.log('denies: ', this.join_denies);

            if(this.join_confirms + this.join_denies < 3)
                break;

            if(this.join_confirms < this.join_denies)
            {
                console.log('JOIN REJECTED');
                this.join_confirms = 0;
                this.join_denies = 0;
                break;
            }else{
                this.join_confirms = 0;
                this.join_denies = 0;
                console.log('JOIN ACCEPTED');
                from = message.from;
            }
            //console.log('confirm join message', message);




        case Chord.FIND_SUCCESSOR:
            if (ChordUtils.DebugNodeJoin || ChordUtils.DebugSuccessor)
                console.log('FIND_SUCCESSOR: from =', from.id, ', this =', this.id, ', this.successor =', this.successor.id, ', message.id =', message.id);

            // Yes, that should be a closing square bracket to match the opening parenthesis.
            // It is a half closed interval.
            if (ChordUtils.isInHalfRange(message.id, this.id, this.successor.id)) {
                if (ChordUtils.DebugSuccessor)
                    console.info('FIND_SUCCESSOR = ' + this.successor.id);

                message.type = Chord.FOUND_SUCCESSOR;
                this.send(this.successor, message, from);

            // Fix finger table,  find successor(key) or read(key)
            } else if (message.hasOwnProperty('next') || message.hasOwnProperty('data')) {
                var n0 = this.closet_finger_preceding(message.id);

                if (ChordUtils.DebugSuccessor)
                    console.info('FIND_SUCCESSOR = closet_finger_preceding = ' + n0.id);

                message.type = Chord.FOUND_SUCCESSOR;
                this.send(n0, message, from);

            // Forward the query around the circle
            } else {
                var n0 = this.closet_finger_preceding(message.id);

                if (ChordUtils.DebugSuccessor)
                    console.log('Forward to =', from.id, ', this =', this.id, ', this.successor =', this.successor.id, ', message.id =', message.id, ', n0 =' + n0.id);

                message.id = n0.id;
                this.send(n0, message, from);
            }

            break;

        case Chord.CHECK_PREDECESSOR:
            // reset our ttl
            message.type = Chord.CHECK_TTL;
            message.predecessor_ttl = this.ttl;

            this.send(this, message, from);

            break;

        case Chord.CHECK_SUCESSOR:
            // reset our ttl
            message.type = Chord.CHECK_TTL;
            message.successor_ttl = this.ttl;

            this.send(this, message, from);

            break;

        case Chord.CHECK_TTL:
            if (message.hasOwnProperty('predecessor_ttl')) {
                this.predecessor_ttl = message.predecessor_ttl;
            }

            if (message.hasOwnProperty('successor_ttl')) {
                this.successor_ttl = message.successor_ttl;
            }

            break;

        // find successor(key)
        case Chord.MESSAGE:
            if (ChordUtils.DebugMessage)
                console.log('Message from', from,' =', message);

            break;

        default:
            console.error('Unknown Chord message: ' + message.type);
            break;
    };
};

/*
 * Export 'Node' class
 */
if (typeof(module) != "undefined" && typeof(exports) != "undefined")
  module.exports = Node;
