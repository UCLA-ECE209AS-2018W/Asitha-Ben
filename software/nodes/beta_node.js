var fs = require('fs');


// Import the Flowchain library
var Flowchain = require('../libs');

// Import Websocket server
var server = Flowchain.WoTServer;

// Utils
var crypto = Flowchain.Crypto;

// Database
var Database = Flowchain.DatabaseAdapter;
var db = new Database('nedb');

var g_tx = null;

function BetaNode(num) {
    this.server = server;


    this.alphaPublicKey = fs.readFileSync('./keys/alpha_public.txt', 'utf8');

    var privateKeyFile = './keys/beta_private' + num + '.txt';
    var publicKeyFile = './keys/beta_public' + num + '.txt';

    this.privateKey = fs.readFileSync(privateKeyFile, 'utf8');
    this.publicKey = fs.readFileSync(publicKeyFile, 'utf8');


    this.name = 'beta';
    this.permissions = 'none';

    this.properties = {"name":this.name, "permissions": this.permissions, "public_key": this.publicKey}

    var props = ["temp", "alarm", "video", "audio"]
    var perms = []
    for(var i = 0; i < Math.random() * props.length; i++){
    	perms.push(props[Math.random() * props.length])
    	console.log(props)
    	console.log(perms)
    	console.log(perms[i])
    }


    this.transactions = []

}

BetaNode.prototype.sign = function(data) {

	var sign = crypto.createSign('SHA256');
   	sign.update(data);
   	var signature = sign.sign(this.privateKey, 'hex');
   	return signature;
}


/*
 * req { tlNode, node, payload, block }
 * res ( save, read, send )
 */
var onmessage = function(req, res) {
	var payload = req.payload;
	var block = req.block;
	var node = req.node;
	var tlNode = req.tlNode;

	var data = JSON.parse(payload.data);
	var message = data.message;
	var from = data.from;
	var info = message.data;

	if(typeof info.type !== 'undefined')
	{
		if(info.type === 'query')
		{
			console.log('received query');
			res.read(g_tx)

		}else if(info.type === 'data'){

			console.log('received data');

			var key = message.id;
			var tx = message.data;

			if(!block) return;

		    var hash = crypto.createHmac('sha256', block.hash)
		                .update( key )
		                .digest('hex');


			var asset = {
				type: 'key',
				key: key
			};

			res.save(asset);

			console.log('placing data ');

			db.put(hash, tx, function(err){
				if (err)
						return console.log('Database put error = ', err);
			});
		}else if(info.type === 'join key'){

			console.log('received join key from alpha');


			//validate signature
			const verify = crypto.createVerify('SHA256');
			verify.update(info.key)


			if(verify.verify(tlNode.alphaPublicKey, info.signature, 'hex')){
				
				console.log('verified');

				//Need to change this to use block
				var hash = crypto.createHmac('sha256', info.name)
                        .update( info.key )
                        .digest('hex');

                db.get(hash, function (err, value){
                	
                	if(value.length === 0){
		                db.put(hash, {'name': info.name, permissions: info.permissions, 'key': info.key }, function(err) {
		                	
		                	if(err) throw err;
		                	console.log('placed data');

		                	res.save(info)
		                });
		            }else{
		            	console.log('value already exists');
		            }

                });
            }else{
            	console.log('verify failed');
            }

		}else if(info.type === 'key'){
			console.log('received key');
			g_tx = key;
		}
	}




		
}

/*
 * req { node }
 * res { save, read}
 */
var onstart = function(req, res) {

};

/*
 * req { node, from, payload, block }
 * res { save, read, send }
 */
var onquery = function(req, res) {

};


/*
 * req { node, from, payload, block }
 * res { save, read, send, cb }
 */
var onjoin = function(req, res) {

	const verify = crypto.createVerify('SHA256');
	
	var from = req.from;
	var payload = req.payload;
	var name = payload.name;
	var key = payload.key;
	var signature = payload.signature;
	

	verify.update(JSON.stringify(from));

	if(!verify.verify(payload.key, payload.signature, 'hex'))
	{
		console.log('join rejected');
		res.cb(false);

	}else{
		//console.log('signature verified')
		var hash = crypto.createHmac('sha256', name)
                        .update( key )
                        .digest('hex');


	    db.get(hash, function (err, value){
	                	
	    	if(value.length === 0){
	    		//console.log('not in db');
	    		console.log('join rejected - nonexistent');
	    		res.cb(false);
	        }else{
	        	//console.log('in db');
	        	res.cb(true);
	        }
	    });
	}
}


/*
 * req { tlNode, node, data }
 * res { save, read }
 */
var ondata = function(req, res) {


	var data = req.data;
    var put = res.save;
   	if(typeof data.message === 'undefined' && typeof data.type === 'undefined')
   	{	
   		console.log('received data: ', data);
    	data.type = 'data';
   	}
    put(data);

};




BetaNode.prototype.start = function() {
	this.server.start({
		onstart: onstart,
		onmessage: onmessage,
		onquery: onquery,
		ondata: ondata,
		onjoin: onjoin,
        join: {
            address: process.env['PEER_ADDR'] || 'localhost',
            port: process.env['PEER_PORT'] || '8000'
        }
	}, this);
};

BetaNode.prototype.clearTransactions = function() {
	this.transactions = [];
}

if (typeof(module) != "undefined" && typeof(exports) != "undefined")
    module.exports = BetaNode;

