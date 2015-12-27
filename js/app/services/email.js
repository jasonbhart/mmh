;(function() {
    "use strict";

    var app = angular.module('mmh.services');
    
    app.factory('emailService', ['appConfig', '$q', '$http', function(appConfig, $q, $http) {
        var getEmailBody = function(email, notification, template) {
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
            
            text += "<br/> <br/> To unsubscribe from this acitvity, please click the link below:";
            text += "<br/>" + getUnsubscribeLink(notification.meetId, email);
            text += "<br/> <br/> To unsubscribe all activities from Socialivo, please click:";
            text += "<br/>" + getUnsubscribeLink('all', email);
            
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
                    getEmailBody(emails[i], notificationData, response.data),
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
            })
        };
        
        var unsubscribeAll = function (userId) {
            var ref = new Firebase(appConfig.firebaseUrl);
            return ref.child('unsubscribe').push(userId);
        }
        
        var unsubscribeActivity = function (activityId, userId) {
            var ref = new Firebase(appConfig.firebaseUrl);
            return ref.child('meets').child(activityId).child('unsubscribe').push(userId);
        }
        
        var getUnsubscribeLink = function (activityId, userId) {
            return appConfig.productionBasePath + 'unsubscribe.html?activity=' + activityId + '&user=' + encodeURIComponent(userId);
        };
        
        var getUnsubscribeList = function (activityId) {
            var mainDefer = $q.defer();
            
            var result = [];
            var ref = new Firebase(appConfig.firebaseUrl);
            ref.child('unsubscribe').on('value', function(unsubAllUsers) {
                unsubAllUsers = unsubAllUsers.val();
                if (unsubAllUsers) {
                    for (var i in unsubAllUsers) {
                        result.push(unsubAllUsers[i]);
                    }
                }
                
                ref.child('meets').child(activityId).child('unsubscribe').on('value', function(unsubActUsers) {
                    unsubActUsers = unsubActUsers.val();
                    if (unsubActUsers) {
                        for (var i in unsubActUsers) {
                            result.push(unsubActUsers[i]);
                        }
                    }
                    
                    mainDefer.resolve(result);
                });
            });
            
            return mainDefer.promise;
        };
        
        return {
            sendEmailToUsers: sendEmailToUsers,
            unsubscribeAll: unsubscribeAll,
            unsubscribeActivity: unsubscribeActivity,
            getUnsubscribeList: getUnsubscribeList
        };
    }]);
})();
