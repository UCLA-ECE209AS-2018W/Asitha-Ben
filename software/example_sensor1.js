var WebSocketClient = require('websocket').client;

var client = new WebSocketClient();

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
            var obj = {temperature: lucky};

            console.log('[SEND]', JSON.stringify(obj));

            connection.sendUTF(JSON.stringify(obj));
            setTimeout(sendNumber, 1000);
        }
    }
    sendNumber();
});


client.connect('ws://131.179.40.65:8000/object/frontdoor/send', '');