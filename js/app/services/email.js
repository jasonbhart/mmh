;(function() {
    "use strict";

    var app = angular.module('mmh.services');
    
    app.factory('emailService', ['appConfig', '$q', '$http', function(appConfig, $q, $http) {
        var getEmailBody = function(notification, template) {
            if (!notification) {
                return '';
            }
            
            if (notification.emailBody) {
                return notification.emailBody;
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
            
            text += "<br/>" + "<br/>" + 'Click here to see everyone who is participating in this activity'
                 +  "<br/>" + appConfig.shareUrlBase + '?act=' + notification.meetId;
            
            text += "<br/><br/><br/>  This email address isn't monitored. Replies to this email will be ignored.";
            
            var params = template.split('*---content---*');
            return params[0] + text + params[1];
        };
        
        var sendEmailToUsers = function (emails, notificationData) {
            $http({
                method: 'GET',
                url: '/js/app/tmpl/email.html'
            }).then(function (response) {
                var emailData = {
                    from: appConfig.sendingEmail,
                    to: emails,
                    subject: notificationData.meetName || notificationData.title,
                    content: 
                    getEmailBody(notificationData, response.data),
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
            }, function(response) {
                console.log('CAN NOT GET EMAIL TEMPLATE: ', response);
            });
        };
        
        return {
            sendEmailToUsers: sendEmailToUsers
        };
    }]);
})();
