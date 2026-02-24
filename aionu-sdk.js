/**
 * AIONU JavaScript SDK
 * Supports IE11, Chrome, Edge
 * Features: Manual XHR Streaming, Markdown Rendering, Parameters & Suggestions
 */
(function(window, $) {
    'use strict';

    function AionUSDK(config) {
        this.endpoint = config.endpoint || 'https://api.abclab.ktds.com/v1';
        this.apiKey = config.apiKey;
        this.conversationId = config.conversationId || null;
    }

    /**
     * Common Ajax Wrapper
     */
    AionUSDK.prototype._request = function(method, path, data, successCallback, errorCallback) {
        $.ajax({
            url: this.endpoint + path,
            type: method,
            headers: {
                'Authorization': 'Bearer ' + this.apiKey,
                'Content-Type': 'application/json'
            },
            data: data ? JSON.stringify(data) : null,
            success: successCallback,
            error: errorCallback
        });
    };

    /**
     * Get Application Parameters
     */
    AionUSDK.prototype.getParameters = function(successCallback, errorCallback) {
        this._request('GET', '/parameters', null, successCallback, errorCallback);
    };

    /**
     * Get Suggested Questions after a message
     */
    AionUSDK.prototype.getSuggested = function(messageId, successCallback, errorCallback) {
        // Based on Dify/AIONU standard: GET /messages/{message_id}/suggested
        this._request('GET', '/messages/' + messageId + '/suggested', null, successCallback, errorCallback);
    };

    /**
     * Refresh conversation (Reset ID)
     */
    AionUSDK.prototype.refresh = function() {
        this.conversationId = null;
        return this.conversationId;
    };

    /**
     * Send Message with Streaming (XHR Manual Implementation)
     */
    AionUSDK.prototype.chatStream = function(params) {
        var self = this;
        var url = this.endpoint + '/chat-messages';
        
        var body = {
            query: params.query,
            inputs: params.inputs || {},
            user: params.user || 'default_user',
            conversation_id: this.conversationId,
            response_mode: 'streaming'
        };

        var xhr = new XMLHttpRequest();
        var seenBytes = 0;
        var fullAnswer = '';

        xhr.open('POST', url, true);
        xhr.setRequestHeader('Authorization', 'Bearer ' + this.apiKey);
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 3 || xhr.readyState === 4) {
                var newData = xhr.responseText.substring(seenBytes);
                seenBytes = xhr.responseText.length;

                var lines = newData.split('\n');
                $.each(lines, function(i, line) {
                    if (line.indexOf('data: ') === 0) {
                        try {
                            var data = JSON.parse(line.substring(6));
                            
                            if (data.event === 'message' || data.event === 'agent_message') {
                                fullAnswer += (data.answer || '');
                                if (params.onMessage) {
                                    params.onMessage(data.answer, fullAnswer, data);
                                }
                            } 
                            
                            if (data.event === 'message_end') {
                                if (data.conversation_id) {
                                    self.conversationId = data.conversation_id;
                                }
                                if (params.onFinished) params.onFinished(fullAnswer, data);
                            }

                            if (data.event === 'error') {
                                if (params.onError) params.onError(data);
                            }
                        } catch (e) { }
                    }
                });
            }

            if (xhr.readyState === 4) {
                if (xhr.status < 200 || xhr.status >= 300) {
                    if (params.onError) params.onError({ status: xhr.status, message: xhr.responseText });
                }
            }
        };

        xhr.onerror = function(err) {
            if (params.onError) params.onError(err);
        };

        xhr.send(JSON.stringify(body));
        return xhr;
    };

    window.AionUSDK = AionUSDK;

})(window, jQuery);
