;(function() {
    "use strict";

    var app = angular.module('mmh.services');
    
    app.factory('emailService', ['appConfig', '$q', '$http', function(appConfig, $q, $http) {
        var getEmailBody = function(email, notification) {
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
            
            text += "\r\n" + "\r\n" + 'Click here to see everyone who is participating in this activity'
                 +  "\r\n" + appConfig.shareUrlBase + '?act=' + notification.meetId;
            
            text += "\r\n \r\n \r\n This email address isn't monitored. Replies to this email will be ignored.";
            
            text += "\r\n \r\n To unsubscribe from this acitvity, please click the link below:";
            text += "\r\n" + getUnsubscribeLink(notification.meetId, email);
            text += "\r\n \r\n To unsubscribe all activities from Socialivo, please click:";
            text += "\r\n" + getUnsubscribeLink('all', email);
            
            return text;
        };
        
        var sendEmailToUsers = function (emails, notificationData) {
            for (var i in emails) {
                var emailData = {
                    from: appConfig.sendingEmail,
                    to: [emails[i]],
                    subject: notificationData.meetName || notificationData.title,
                    content: getEmailBody(emails[i], notificationData),
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
            }
        };
        
        var unsubscribeAll = function (userId) {
            var ref = new Firebase(appConfig.firebaseUrl);
            return ref.child('unsubsribe').push(userId);
        }
        
        var unsubscribeActivity = function (activityId, userId) {
            var ref = new Firebase(appConfig.firebaseUrl);
            return ref.child('meets').child(activityId).child('unsubsribe').push(userId);
        }
        
        var getUnsubscribeLink = function (activityId, userId) {
            return appConfig.productionBasePath + 'unsubscribe.html?activity=' + activityId + '&user=' + encodeURIComponent(userId);
        };
        
        return {
            sendEmailToUsers: sendEmailToUsers,
            unsubscribeAll: unsubscribeAll,
            unsubscribeActivity: unsubscribeActivity
        };
    }]);
})();
