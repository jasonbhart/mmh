;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.factory('notificationService', 
    ['$rootScope', 'appConfig', '$firebaseObject', '$q',
    function($rootScope, appConfig, $firebaseObject, $q) {
        var ref = new Firebase(appConfig.firebaseUrl);
        
        var addNotificationToUser = function (userId, notificationData) {
            console.log('Adding notification to user', userId, notificationData);
            ref.child('notifications').child(userId).push(notificationData)
        };
        
        var countUnreadNotifications = function (userId) {
            var deferred = $q.defer();
                      
            var unreadNotification = 0;
            ref.child('notifications').child(userId).orderByChild('status').equalTo('1').once("value", function(snapshot) {
                if (snapshot.val()) {
                    unreadNotification = snapshot.numChildren();
                }
                deferred.resolve(unreadNotification);
            });
            return deferred.promise;
        };
        
        var resetNotifications = function (userId) {
            ref.child('notifications').child(userId).orderByChild('status').equalTo('1').once("value", function(snapshot) {
                var notifications = snapshot.val();
                if (notifications) {
                    _.forEach(notifications, function(notification, key) {
                        ref.child('notifications').child(userId).child(key).update({status: '0'})
                    });
                }
            });
        }
        
        var getLastNotifications = function (userId) {
            var deferred = $q.defer();
            
            ref.child('notifications').child(userId).endAt().limit(10).once("value", function(snapshot) {
                var data = snapshot.val();
                if (data) {
                    var arrayData = Object.keys(data).map(function (key) {
                        data[key].id = key;
                        return data[key];
                    });
                    deferred.resolve(arrayData);
                } else {
                    deferred.resolve([]);
                }
            });
            return deferred.promise;
        };
        
        var broadcastChange = function (userId) {
            countUnreadNotifications(userId).then(function(count) {
                var data = {
                    userId: userId,
                    count: count
                };
                $rootScope.$broadcast('notification.changed', data);
            });
        };
        
        var trackNotification = function (userId) {
            var notificationRef = ref.child('notifications').child(userId);
            
            // new notification
            notificationRef.endAt().limit(1).on('child_added', function() {
                broadcastChange(userId);
            });
                      
            // reset notification
            notificationRef.on('child_changed', function() {
                broadcastChange(userId);
            });
            
        };
        
        var removeNotification = function (userId, notificationId) {
            var notificationRef = ref.child('notifications').child(userId);
            notificationRef.child(notificationId).remove();
        };
        
        var removeAllNotification = function (userId) {
            var notificationRef = ref.child('notifications').child(userId);
            notificationRef.remove();
        };
        
        return {
            addNotificationToUser: addNotificationToUser,
            countUnreadNotifications: countUnreadNotifications,
            getLastNotifications: getLastNotifications,
            trackNotification: trackNotification,
            resetNotifications: resetNotifications,
            removeNotification: removeNotification,
            removeAllNotification: removeAllNotification
        }
    }]);
})();
