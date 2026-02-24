/**
 * AIONU JavaScript SDK
 * Supports IE11 (via Polyfill), Chrome, Edge
 * Features: SSE Streaming, Markdown Rendering
 */
(function(window, $) {
    'use strict';

    function AionUSDK(config) {
        this.endpoint = config.endpoint || 'https://api.abclab.ktds.com/v1';
        this.apiKey = config.apiKey;
        this.conversationId = config.conversationId || null;
    }

    /**
     * Refresh conversation (Reset ID)
     */
    AionUSDK.prototype.refresh = function() {
        this.conversationId = null;
        return this.conversationId;
    };

    /**
     * Send Message with Streaming (SSE)
     * @param {Object} params - { query, inputs, user, onMessage, onFinished, onError }
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

        // Use EventSourcePolyfill for Header support (Authorization) and IE11 compatibility
        var es = new EventSourcePolyfill(url, {
            headers: {
                'Authorization': 'Bearer ' + this.apiKey,
                'Content-Type': 'application/json'
            },
            method: 'POST',
            body: JSON.stringify(body),
            heartbeatTimeout: 60000
        });

        var fullAnswer = '';

        es.onmessage = function(event) {
            try {
                var data = JSON.parse(event.data);
                
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
                    es.close();
                    if (params.onFinished) params.onFinished(fullAnswer, data);
                }

                if (data.event === 'error') {
                    es.close();
                    if (params.onError) params.onError(data);
                }
            } catch (e) {
                console.error('Error parsing SSE data', e);
            }
        };

        es.onerror = function(err) {
            console.error('EventSource failed', err);
            es.close();
            if (params.onError) params.onError(err);
        };

        return es; // Return to allow manual closing if needed
    };

    // Export to window
    window.AionUSDK = AionUSDK;

})(window, jQuery);
