var Common = require("./common.js");
var GameObjects = require("./gameobjects.js");

var World = Common.Class.extend({

	uid : null,
	players : [],
	entities : [],

	toString : function() {
		return "World { uid: " + this.uid + " }";
	},

	init : function(uid) {
		Common.assert(uid != null, "cannot generate world without uid");
		this.uid = uid;
	},

	connectPlayerToWorld : function(player) {
		Common.assert(player instanceof GameObjects.Player, "not a player");
		console.log(this.toString(), "adding player to world", player.toString());
		this.players.push(player);
		this.sendWorldToPlayer(player);
	},

	removePlayerFromWorld : function(player) {
		Common.assert(player instanceof GameObjects.Player, "not a player");
		console.log(this.toString(), "removing player from world", player.toString());
		var idx = -1;
		while ((idx = this.players.indexOf(player)) != -1)
			this.players.splice(idx, 1);
	},

	spawnEntityInWorld : function(entity) {
		Common.assert(entity instanceof GameObjects.Entity, "not an entity");
		var next = 0;
		while (true) {
			var dup = false;
			next = Math.floor(Math.random() * (Number.MAX_VALUE - 1));
			for (var i = 0; i < this.entities.length; i++) {
				var entity = this.entities[i];
				if (entity.id == next) {
					dup = true;
					break;
				}
			}
			if (!dup)
				break;
		}
		entity.id = next;
		this.entities.push(entity);
	},

	removeEntityFromWorld : function(entity) {
		Common.assert(entity instanceof GameObjects.Entity, "not an entity");
		var idx = -1;
		while ((idx = this.entities.indexOf(player)) != -1)
			this.entities.splice(idx, 1);
	},

	sendWorldToPlayer : function(player) {
		// TODO: Send world data to player
		console.log(player.toString(), "sending world data...");
		player.sendDataToPlayer([ {
			type : "world",
			uid : this.uid
		} ]);
		console.log(player.toString(), "done sending descriptors");
	},

	update : function() {
		for (var i = 0; i < this.players.length; i++) {
			var player = this.players[i];
			player.update(this);
			if (player.invalid()) {
				console.log(player.toString(), "player invalidated, collecting");
				this.removePlayerFromWorld(player);
			}
		}
		for (var i = 0; i < this.entities.length; i++) {
			var entity = this.entities[i];
			entity.update(this);
			if (entity.invalid()) {
				console.log(entity.toString(), "entity invalidated, collecting");
				this.removeEntityFromWorld(entity);
			}
		}
	}

});

module.exports = {
	GameObjects : GameObjects,
	World : World
}