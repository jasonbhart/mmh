;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    app.controller('UserAccountController', ['$scope', '$log', 'sessionService', 'dialogs', 'notificationService', 
    function($scope, $log, sessionService, dialogs, notificationService) {
        $scope.isAuthenticated = false;
        $scope.user = null;
        $scope.countNotification = 0;
        $scope.notifications = [];

        $scope.login = function() { 
            dialogs.auth();
        }

        $scope.logout = function() {
            sessionService.logout();
        }
        
        $scope.$on('auth.changed', function(evt, user) {
            $log.log('Event: auth.changed', user);
            $scope.user = user;
            $scope.isAuthenticated = !user.isAnonymous();
            notificationService.countUnreadNotifications(user.id).then(function(count) {
                $scope.countNotification = count;
            });
            notificationService.getLastNotifications(user.id).then(function(notifications) {
                $scope.notifications = notifications;
                console.log(notifications);
            });
            notificationService.trackNotification(user.id);
        });
        
        $scope.$on('notification.changed', function (evt, data) {
            if ($scope.user && $scope.user.id == data.userId) {
                $scope.countNotification = data.count; 
            }
        });
        
        $scope.getNotificationText = function(notification) {
            if (!notification) {
                return '';
            }
            
            if (notification.type == 'time') {
                return 'New time ' + moment(notification.value).format('h:mmA') + ' added to <b> ' + notification.meetName + '</b>';
            } else if (notification.type == 'place') {
                return 'New place added to <b> ' + notification.meetName + '</b>';
            } else if (notification.type == 'group') {
                return 'New group added to <b> ' + notification.meetName + '</b>';
            }
        }
    }]);
})();
