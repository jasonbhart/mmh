;(function () {
    "use strict";

    var app = angular.module('mmh.directives');
    
    app.directive('localMeetings', ['meetingService', 'util', function(meetingService, util) {
        return {
            restrict: 'E',
            scope: {
                excludeMeeting: '@',
                location: '=',
                radius: '=',
                count: '@'
            },
            templateUrl: 'js/app/tmpl/localMeetings.html',
            link: function(scope, element, attrs) {
                // for example we want 3 results but it is impossible to exclude current meeting from the search,
                // so +1 and we will exclude it manually
                scope.count++;
                
                scope.lastMeetings = null;
                scope.localEventIds = [];
                             
                scope.meetings = [];

                meetingService.getLastMeetings(50).$loaded(function(lastMeetings) {
                    scope.lastMeetings = lastMeetings;
                });
                
                var getLocalEvents = function(mapOptions) {
                    if (scope.lastMeetings === null) {
                        setTimeout(function() {
                            getLocalEvents(mapOptions);
                        }, 1000);
                        return false;
                    }
                    
                    scope.meetings = [];
                    scope.localEventIds = [];

                    for (var i in scope.lastMeetings) {
                        if (typeof scope.lastMeetings[i] === 'object' && scope.lastMeetings[i] && scope.lastMeetings[i].name) {
                            var distance = meetingService.calculateDistanceToMeeting(scope.lastMeetings[i], mapOptions);
                            if (distance < mapOptions.radius) {
                                scope.lastMeetings[i].id = i;
                                scope.lastMeetings[i].url = 'activity.html?act=' + i;
                                scope.lastMeetings[i].formatedTime = util.formatTime(scope.lastMeetings[i].timeTitle);

                                var finished = meetingService.checkIfFinished(scope.lastMeetings[i].when);
                                var creatorId = meetingService.getCreatorId(scope.lastMeetings[i].users);
                                var userId = $.cookie('guid');
                                var joined = scope.lastMeetings[i].users && 
                                             scope.lastMeetings[i].users[userId] &&
                                             scope.lastMeetings[i].users[userId].group;

                                if (!finished && !joined && creatorId !== userId && scope.excludeMeeting !== i) {
                                    scope.meetings.push(scope.lastMeetings[i]);
                                    scope.localEventIds.push(i);
                                }                      
                            }
                        }
                    }
                    $.cookie('local_events', JSON.stringify(scope.localEventIds), {expire: 0.05});
                };
                
                scope.$watchGroup(['location', 'radius', 'excludeMeeting'], function(values) {
                    if (scope.location) {
                        var mapOptions = {
                            coords: scope.location,
                            radius: util.convertMilesToKms(10)
                        };
                        getLocalEvents(mapOptions);
                    }
                });
                
                scope.jumpin = function() {
                    util.addEventToDataLayer('Activity', 'Interaction', 'Jump In', null);
                };
            }
        };
    }]);
})();
