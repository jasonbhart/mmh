;(function() {
    "use strict";

    var app = angular.module('mmh.services');
    
    app.factory('emailService', ['appConfig', '$q', '$http', function(appConfig, $q, $http) {
        var getEmailBody = function(notification) {
            if (!notification) {
                return '';
            }

            var text = '';

            if (notification.type === 'time') {
                text = 'New time ' + moment(notification.value).format('h:mmA') + ' added to ' + notification.meetName;
            } else if (notification.type === 'place') {
                text = 'New place ' + notification.value + ' added to ' + notification.meetName;
            } else if (notification.type === 'group') {
                text = 'New group (' + notification.value + ') added to activity ' + notification.meetName;
            } else if (notification.type === 'user') {
                text = 'New user ' + notification.value + ' joined activity ' + notification.meetName;
            } else if (notification.type === 'rsvp') {
                text = 'User ' + notification.value + ' has RSVP\'d to the activity \'' 
                        + notification.meetName.trim() + '\' ('
                        + moment(notification.time).format('h:mmA') 
                        + ' - ' + notification.place + ')';
                        
            }
            
            text += "\r\n" + "\r\n" + 'Click here to see everyone who is participating in this activity'
                 +  "\r\n" + appConfig.shareUrlBase + '?act=' + notification.meetId;
            
            text += "\r\n \r\n \r\n This email address isn't monitored. Replies to this email will be ignored.";
            return text;
        };
        
        var sendEmailToUsers = function (emails, notificationData) {
            var emailData = {
                from: appConfig.sendingEmail,
                to: emails,
                subject: notificationData.meetName,
                content: getEmailBody(notificationData),
                replyTo: [appConfig.replyEmail]
            };
            console.log(emailData);
            
            $http.post(appConfig.sendEmailURL, emailData).then(
                function() {
                    console.log('Sending Email successfully');
                }, 
                function() {
                    console.log('Sending Email fail');
                }
            );
        };
        
        return {
            sendEmailToUsers: sendEmailToUsers
        };
    }]);
})();
