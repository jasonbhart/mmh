;(function () {
    "use strict";

    var app = angular.module('mmh.directives');
    
    app.directive('header', ['util', 'userService', 'sessionService', function(util, userService, sessionService) {
        return {
            restrict: 'E',
            scope: {
            },
            templateUrl: 'js/app/tmpl/header.html',
            link: function(scope) {
                if (window.location.href.indexOf('create_new_meeting') > -1) {
                    scope.currentPage = 3;              // new meet page
                } else if (window.location.href.indexOf('meeting') > -1) {
                    scope.currentPage = 2;              // meeting page
                } else {
                    scope.currentPage = 1;              // homepage
                }
                
                sessionService.ready.then(function() {
                    var currentUser = sessionService.getCurrentUser();
                    userService.get(currentUser.id).then(function(user) {
                        user.meetingList.$loaded().then(function(data) {
                            scope.meetingList = data;
                        });
                    });
                });
                
                scope.currentMeetingId = util.getUrlParams('meet');
            }
        };
    }]);
})();
