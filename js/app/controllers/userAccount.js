;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    app.controller('UserAccountController', ['$scope', '$log', 'sessionService', 'dialogs', 'notificationService', '$sce', '$window','util', 'userService',
    function($scope, $log, sessionService, dialogs, notificationService, $sce, $window, util, userService) {
        $scope.isAuthenticated = false;
        $scope.user = null;
        $scope.countNotification = '';
        $scope.notifications = [];
        $scope.registrationId = '';

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
            
            notificationService.trackNotification(user.id);
            
            if ($scope.registrationId) {
                userService.get(user.id).then(function(userObj) {
                    userObj.saveRegistrationId($scope.registrationId);
                });
            }
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
            
            if (notification.type === 'time') {
                text = 'New time <b>' + moment(notification.value).format('h:mmA') + '</b> added to <b> ' + notification.meetName + '</b>';
            } else if (notification.type === 'place') {
                text = 'New place <b>' + notification.value + '</b> added to <b> ' + notification.meetName + '</b>';
            } else if (notification.type === 'group') {
                if (notification.time && notification.place) {
                    text = 'New group <b>' +  notification.place + ' @ ' + moment(notification.time).format('h:mmA') + '</b> added to <b> ' + notification.meetName + '</b>';
                } else {
                    text = 'New group <b>' + notification.value + '</b> added to <b> ' + notification.meetName + '</b>';
                }
            } else if (notification.type === 'user') {
                text = 'New user <b>' + notification.value + '</b> joined activity <b> ' + notification.meetName + '</b>';
            } else if (notification.type === 'rsvp') {
                text = 'User <b>' + notification.value + '</b> joined activity <b> ' 
                        + notification.meetName + '('
                        + notification.place 
                        + ' @ ' 
                        + moment(notification.time).format('h:mmA') + ')</b>';
            }
            return $sce.trustAsHtml(text);
        }
        
        $scope.clearNotification = function (key, notificationId) {
            if ($scope.user && $scope.user.id) {
                notificationService.removeNotification($scope.user.id, notificationId);
                $scope.notifications.splice(key,1);
                if ($scope.notifications.length === 0) {
                    setTimeout(function() {
                        $window.$('#notifications-info').hide();
                    }, 100);
                }
                util.addEventToDataLayer('Notifications', 'Clear', null, notificationId);
            }
        };
        
        $scope.clearAllNotification = function () {
            if ($scope.user && $scope.user.id) {
                notificationService.removeAllNotification($scope.user.id);
                $scope.notifications = [];
                setTimeout(function() {
                    $window.$('#notifications-info').hide();
                }, 100);
                
                util.addEventToDataLayer('Notifications', 'Clear', null, 'All');
            }
        };
        
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
        $('.notifications .dropdown-button').click(function() {
            if ($('#notifications-info').is(':visible')) {
                $('#notifications-info').hide();
                return false;
            }
        });
        $('body').click(function() {
            $('#notifications-info').hide();
        });
        
        $(document).ready(function() {
            if (ChromePushManager) {
                var chromePushManager = new ChromePushManager('service-worker.js', function (error, registrationId) {
                    console.log(registrationId);
                    $scope.registrationId = registrationId;
                }); 
            }
            
        });
    }]);
})();
