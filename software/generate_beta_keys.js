var keypair = require('keypair');
var fs = require('fs');

var pair = keypair();

var num = process.argv[2];


fs.writeFile('./keys/beta_public' + num + '.txt', pair.public, function(err) {
	if(err) throw err;
});

fs.writeFile('./keys/beta_private' + num + '.txt', pair.private, function(err) {
	if(err) throw err;
});