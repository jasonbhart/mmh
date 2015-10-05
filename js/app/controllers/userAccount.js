;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    app.controller('UserAccountController', ['$scope', '$log', 'sessionService', 'dialogs', 'notificationService', '$sce',
    function($scope, $log, sessionService, dialogs, notificationService, $sce) {
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
            
            notificationService.trackNotification(user.id);
        });
        
        $scope.$watch('countNotification', function (newValue, oldValue) {
            if ($scope.user) {
                notificationService.getLastNotifications($scope.user.id).then(function(notifications) {
                    $scope.notifications = notifications.reverse();
                });
            }
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
            
            var text = '';
            
            if (notification.type == 'time') {
                text = 'New time <b>' + moment(notification.value).format('h:mmA') + '</b> added to <b> ' + notification.meetName + '</b>';
            } else if (notification.type == 'place') {
                text = 'New place added to <b> ' + notification.meetName + '</b>';
            } else if (notification.type == 'group') {
                text = 'New group added to <b> ' + notification.meetName + '</b>';
            }
            return $sce.trustAsHtml(text);
        }
        
        $('.notifications').click(function(e) {
            $('#notifications-info').css({
                width: '0px',
                position: 'absolute',
                top: '0px',
                left: '-320px',
                opacity: 1,
                display: 'block'
            });
            
            if ($scope.user) {
                notificationService.resetNotifications($scope.user.id);
            }
            
            e.stopPropagation();
        });
        $('body').click(function() {
            $('#notifications-info').hide();
        });
    }]);
})();
