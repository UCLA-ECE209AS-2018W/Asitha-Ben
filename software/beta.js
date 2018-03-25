var BetaNode = require('./index').BetaNode;


var betaNodeNum = process.argv[2]


var node = new BetaNode(betaNodeNum);

node.start();