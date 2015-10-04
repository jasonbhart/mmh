;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.factory('notificationService', 
    ['$rootScope', 'appConfig', '$firebaseObject', '$q',
    function($rootScope, appConfig, $firebaseObject, $q) {
        var ref = new Firebase(appConfig.firebaseUrl + '/users');
        
        var addNotificationToUser = function (userId, notificationData) {
            console.log('Adding notification to user', userId, notificationData);
            var userRef = ref.child(userId);
            userRef.child('notifications').push(notificationData)
        };
        
        var countUnreadNotifications = function (userId) {
            var deferred = $q.defer();
                      
            var userRef = ref.child(userId);
            var unreadNotification = 0;
            userRef.child('notifications').orderByChild('status').equalTo('1').once("value", function(snapshot) {
                if (snapshot.val()) {
                    unreadNotification = snapshot.numChildren();
                }
                deferred.resolve(unreadNotification);
            });
            return deferred.promise;
        };
        
        var getLastNotifications = function (userId) {
            var deferred = $q.defer();
            
            var userRef = ref.child(userId);
            userRef.child('notifications').endAt().limit(2).once("value", function(snapshot) {
                if (snapshot.val()) {
                    deferred.resolve(snapshot.val());
                } else {
                    deferred.resolve([]);
                }
            });
            return deferred.promise;
        };
        
        var trackNotification = function (userId) {
            var userRef = ref.child(userId);
            userRef.on('child_changed', function() {
                countUnreadNotifications(userId).then(function(count) {
                    var data = {
                        userId: userId,
                        count: count
                    };
                    $rootScope.$broadcast('notification.changed', data);
                });
            });
            
        };
        
        return {
            addNotificationToUser: addNotificationToUser,
            countUnreadNotifications: countUnreadNotifications,
            getLastNotifications: getLastNotifications,
            trackNotification: trackNotification
        }
    }]);
})();
