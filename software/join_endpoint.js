var fs = require('fs');

var WebSocketClient = require('websocket').client;

var client = new WebSocketClient();

var num = process.argv[2];

client.on('connectFailed', function(error) {
    console.log('Connect Error: ' + error.toString());
});

client.on('connect', function(connection) {
    console.log('WebSocket client connected');
    connection.on('error', function(error) {
        console.log("Connection Error: " + error.toString());
    });
    connection.on('close', function() {
        console.log('echo-protocol Connection Closed');
    });

    function sendNumber() {
        if (connection.connected) {
            var number = Math.round(Math.random() * 0xFFFFFF);
            var lucky = Math.round(Math.random() * 100 + 1);

            betaKey = fs.readFileSync('./keys/beta_public' + num + '.txt', 'utf8');
            var obj = {"name":"beta", "permissions":"temp", "key": betaKey, "type" : "join key"}

            //console.log('[SEND]', JSON.stringify(obj));

            connection.sendUTF(JSON.stringify(obj));
        }
    }
    sendNumber();
});


client.connect('ws://127.0.0.1:8000/object/frontdoor/send', '');