'use strict';

/* Copyright 2014 Azure Standard https://www.azurestandard.com/
 * Released under the MIT license (http://opensource.org/licenses/MIT).
 *
 * A WebSocket service for AngularJS
 */

var websocketModule = angular
    .module('websocket', [])
    .factory('$websocket', ['$rootScope', function($rootScope) {
        var make_message = function (topic, body) {
            return topic + " " + JSON.stringify(body);
        };

        var parse_message = function (msg) {
            var topic, body, parts;
            parts = msg.split(" ", 1);
            topic = parts[0];
            body = JSON.parse(msg.substring(topic.length + 1));
            return {"topic": topic, "body": body};
        };

        var send = function (wrapped_websocket, msg) {
            if (wrapped_websocket.ready) {
                wrapped_websocket.websocket.send(msg);
            } else {
                wrapped_websocket.queue.push(msg);
            }
        };

        var onopen = function (wrapped_websocket) {
            console.log('opened socket', wrapped_websocket.endpoint);
            wrapped_websocket.ready = true;
            if (wrapped_websocket.queue.length) {
                wrapped_websocket.queue.forEach(function (item) {
                    send(wrapped_websocket, item);
                });
            }
            wrapped_websocket.queue = [];
        };

        var onerror = function (wrapped_websocket, error) {
            console.log('socket error', wrapped_websocket.endpoint, error);
        };

        var onmessage = function(wrapped_websocket, msg) {
            var parsed;
            parsed = parse_message(msg.data);
            //This is a 'service' level message, which all service
            //consumers should listen to, and react by reloading.
            if (parsed.topic == '/refresh') {
                window.location.reload();
            }
            handle(wrapped_websocket, parsed.topic, parsed.body)
            $rootScope.$apply();
        };

        var register = function(wrapped_websocket, topic, callback, options) {
            if (!options) {
                options = {};
            }
            if (!('exact' in options)) {
                options.exact = false;
            }
            if (!wrapped_websocket.listeners[topic]) {
                wrapped_websocket.listeners[topic] = [];
            }
            if (wrapped_websocket.listeners[topic].indexOf(callback) == -1) {
                wrapped_websocket.listeners[topic].push({
                    callback: callback,
                    options: options
                });
            }
        };

        var handle = function (wrapped_websocket, topic, body) {
            var interested = [];
            Object.keys(wrapped_websocket.listeners).forEach(function (key) {
                if (topic.indexOf(key) === 0) {
                    wrapped_websocket.listeners[key].forEach(function (listener) {
                        if (listener.options.exact && key != topic) {
                            return;
                        }
                        if (interested.indexOf(listener.callback) == -1) {
                            listener.callback(topic, body);
                            interested.push(listener.callback);
                        }
                    });
                }
            });
        };

        return {
            connect: function (endpoint) {
                var wrapped_websocket = {
                    endpoint: endpoint,
                    websocket: null,
                    ready: false,
                    queue: [],
                    listeners: {},

                    emit: function(topic, body) {
                        send(this, make_message(topic,body));
                    },

                    register: function (topic, callback, options) {
                        register(this, topic, callback, options);
                    },
                };
                console.log('connect to', endpoint);
                wrapped_websocket.websocket = new window.WebSocket(endpoint);

                wrapped_websocket.websocket.onopen = function () {
                    return onopen(wrapped_websocket);
                };

                wrapped_websocket.websocket.onerror = function (error) {
                    return onerror(wrapped_websocket, error);
                };

                wrapped_websocket.websocket.onmessage = function (msg) {
                    return onmessage(wrapped_websocket, msg);
                };

                return wrapped_websocket;
            },
        };
    }]);
