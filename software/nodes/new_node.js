// Import the Flowchain library
var Flowchain = require('../libs');

// Import Websocket server
var server = Flowchain.WoTServer;

// Utils
var crypto = Flowchain.Crypto;

// Database
var Database = Flowchain.DatabaseAdapter;
var db = new Database('picodb');

function NewNode() {
    this.server = server;
    this.chordNode = null;
    var prime_length = 60;
    this.dh = crypto.createDiffieHellman(prime_length);
    this.dh.generateKeys('hex')

	console.log("Public Key : " ,this.dh.getPublicKey('hex'));
	console.log("Private Key : " ,this.dh.getPrivateKey('hex'));
	this.properties = {"name":"node", "permissions":"none", "public_key": this.dh.getPublicKey('hex')}
}

/*
 * req { node, payload, block }
 * res ( save, read, send )
 */
var onmessage = function(req, res) {

}

/*
 * req { node }
 * res { save, read}
 */
var onstart = function(req, res) {
	this.chordNode = req.node;
}

/*
 * req { node, payload, block, tx }
 * res ( save, read, send )
 */
var onquery = function(req, res) {

}

/*
 * req { node, data: packet }
 * res { save, read }
 */
var ondata = function(req, res) {

}




NewNode.prototype.start = function() {
	this.server.start({
		onstart: onstart,
		onmessage: onmessage,
		onquery: onquery,
		ondata: ondata
	});
};

if (typeof(module) != "undefined" && typeof(exports) != "undefined")
    module.exports = NewNode;

