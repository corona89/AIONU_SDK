/**
 * AIONU JavaScript SDK
 * Supports IE11, Chrome, Edge
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
     * Send Message (Chat)
     */
    AionUSDK.prototype.chat = function(params, successCallback, errorCallback) {
        var self = this;
        var data = {
            query: params.query,
            inputs: params.inputs || {},
            user: params.user || 'default_user',
            conversation_id: this.conversationId,
            response_mode: 'blocking' // JS/jQuery usually handles blocking easier for IE11
        };

        $.ajax({
            url: this.endpoint + '/chat-messages',
            type: 'POST',
            auto: false,
            headers: {
                'Authorization': 'Bearer ' + this.apiKey,
                'Content-Type': 'application/json'
            },
            data: JSON.stringify(data),
            success: function(response) {
                if (response.conversation_id) {
                    self.conversationId = response.conversation_id;
                }
                if (successCallback) successCallback(response);
            },
            error: function(xhr, status, error) {
                if (errorCallback) errorCallback(xhr, status, error);
            }
        });
    };

    // Export to window
    window.AionUSDK = AionUSDK;

})(window, jQuery);
