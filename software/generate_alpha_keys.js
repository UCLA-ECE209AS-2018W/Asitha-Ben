var keypair = require('keypair');
var fs = require('fs');

var pair = keypair();


fs.writeFile('./keys/alpha_public.txt', pair.public, function(err) {
	if(err) throw err;
});

fs.writeFile('./keys/alpha_private.txt', pair.private, function(err) {
	if(err) throw err;
});