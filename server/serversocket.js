var WebSocket = require('ws');
var querystring = require('querystring');
var http = require("http");

var Common = require("./common.js");

function Packet(payloads) {
	this.timestamp = new Date().getTime();
	this.payloads = payloads;

	this.serialize = function() {
		return JSON.stringify({
			timestamp : this.timestamp,
			msgs : this.payloads
		});
	}

	this.deserialize = function(str) {
		var blob = JSON.parse(str);
		this.timestamp = blob.timestamp;
		this.payloads = blob.msgs;
	}
}

function ClientSocket(server, socket) {

	/** The callbacks registered on this socket's events */
	this.callbacks = {
		opening : [],
		open : [],
		close : [],
		error : [],
		message : [],
		packet : []
	};

	this._socket = socket;
	this._server = server;
	this._handshake = false;

	this.toString = function() {
		return "ServerSocket { " + this._socket._socket.remoteAddress + ":" + this._socket._socket.remotePort + " }";
	}

	/**
	 * Bind a callback function to an event type.
	 * 
	 * @param event
	 *            The event type
	 * @param fn
	 *            The function
	 */
	this.bind = function(event, fn) {
		Common.assert(this.callbacks[event], "No such event type");
		this.callbacks[event].push(fn);
	}

	/**
	 * Initializes the client connection handler.
	 */
	this.init = function() {
		console.log(this.toString(), "opening connection");
		this._handshake = false;
		this._handleEvtOpening();
		this._socket.onopen = Common.decoratedCallback(this._handleEvtOpen, this);
		this._socket.onclose = Common.decoratedCallback(this._handleEvtClose, this);
		this._socket.onerror = Common.decoratedCallback(this._handleEvtError, this);
		this._socket.onmessage = Common.decoratedCallback(this._handleEvtMessage, this);
	}

	/**
	 * Closes the connection. The client is disconnected gracefully
	 * 
	 * @param code
	 *            The status code to send to the server
	 * @param data
	 *            The final data payload to send to the server, if any
	 */
	this.close = function(code, data) {
		console.log(this.toString(), "software requested close", code, data);
		this._handshake = false;
		this._socket.close(code, JSON.stringify(data));
	}

	/**
	 * Check if the socket is ready to send data. The socket can accept data if
	 * the underlying socket is not ready to send data to a server.
	 * 
	 * @returns If the socket is ready to send data.
	 */
	this.ready = function() {
		if (this._socket == null)
			return false;
		return this._handshake && this._socket.readyState == WebSocket.OPEN;
	}

	/**
	 * <p>
	 * Send a data payload to the client via the underlying socket. If the
	 * socket is not currently open, then the payload will be be ignored.
	 * </p>
	 * <p>
	 * If the payload is not a Packet, the payload is wrapped inside a Packet
	 * container and is dispatched. Else, the packet is dispatched as-is.
	 * </p>
	 */
	this.send = function(data, ignoreready) {
		if (!(data instanceof Packet))
			data = new Packet(data);
		if (this.ready() || ignoreready)
			this._socket.send(data.serialize());
		else
			console.error("socket not ready", {
				handshake : this._handshake,
				state : this._socket.readyState
			});
	}

	this._fireCallbacks = function(event, args) {
		var callbacks = this.callbacks[event];
		if (callbacks == undefined || callbacks == null) {
			console.log(this.toString(), "unexpected callback type", event);
			return;
		}
		for (var i = 0; i < callbacks.length; i++) {
			var callback = callbacks[i];
			try {
				callback.apply(this, args);
			} catch (e) {
				// TODO: Log exception somewhere, continue gracefully!
				console.error(e);
				throw e;
			}
		}
	}

	this._handleEvtOpening = function() {
		console.log(this.toString(), "client socket opening");
		this._handshake = false;
		this._fireCallbacks("opening", arguments);
	}

	this._handleEvtOpen = function() {
		console.log(this.toString(), "client socket opened");
		this._handshake = false;
	}

	this._handleEvtClose = function() {
		console.log(this.toString(), "client socket closing");
		this._handshake = false;
		this._fireCallbacks("close", arguments);
	}

	this._handleEvtError = function() {
		console.log(this.toString(), "client socket error");
		this._fireCallbacks("error", arguments);
	}

	this._handleEvtMessage = function(message) {
		var typeofz = message.type;
		if (typeofz == "message") {
			var chunk = message.data;
			this._fireCallbacks("message", [ chunk ]);
			var packet = new Packet(null);
			packet.deserialize(chunk);
			if (packet.payloads.length == 1) {
				var payload = packet.payloads[0];
				if (payload.type == "handshake") {
					this._handleHelloHandshake(payload);
					return;
				}
			}
			if (!this._handshake) {
				this.close(Common.Network.CODE_HANDSHAKE_ERR, {
					reason : "Missing network handshake"
				});
			} else
				this._fireCallbacks("packet", [ packet ]);
		} else
			console.error(this.toString(), "unexpected payload type", typeofz);
	}

	this._handleHelloHandshake = function(payload) {
		if (payload.accessToken == undefined || payload.accessToken == null || payload.clientToken == undefined
				|| payload.clientToken == null) {
			var response = new Packet([ {
				type : "handshake",
				result : false,
				message : "Missing tokens"
			} ]);
			this.send(response, true);
		} else {
			var params = {
				token : payload.accessToken,
				secret : payload.clientToken
			};
			var data = querystring.stringify(params);
			console.log(this.toString(), "got handshake", params.token);
			var headers = {
				host : 'localhost',
				port : '8081',
				path : '/v1/validate',
				method : 'POST',
				headers : {
					'Content-Type' : 'application/x-www-form-urlencoded',
					'Content-Length' : data.length
				}
			};

			var request = http.request(headers, Common.decoratedCallback(function(res) {
				res.on("data", Common.decoratedCallback(function(chunk) {
					var result = JSON.parse(chunk);
					console.log(this.toString(), "authentication result", result.status);
					var response = new Packet([ {
						type : "handshake",
						result : result.status,
						message : result.message
					} ]);
					this.send(response, true);
					if (result.status == "200") {
						this._handshake = true;
						this._fireCallbacks("open", []);
					}
				}, this));
			}, this));
			request.write(data);
			request.end();
		}
	}
}

module.exports = {
	ClientSocket : ClientSocket,
	Packet : Packet
}