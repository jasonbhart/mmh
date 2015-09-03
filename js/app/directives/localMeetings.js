;(function () {
    "use strict";

    var app = angular.module('mmh.directives');
    
    app.directive('localMeetings', function() {
        return {
            restrict: 'E',
            scope: {
                excludeMeeting: '@',
                location: '=',
                radius: '=',
                count: '@'
            },
            templateUrl: 'js/app/tmpl/localMeetings.html',
            controller: ['$scope', '$log', 'dataProvider', 'meetingService', 'localMeetingService', function($scope, $log, dataProvider, meetingService, localMeetingService) {
                // for example we want 3 results but it is impossible to exclude current meeting from the search,
                // so +1 and we will exclude it manually
                $scope.count++;

                $scope.meetings = [];

                var types = {};
                _.forEach(dataProvider.getTerms(), function(term) {
                    types[term.id] = term.name;
                });
                    
                $scope.$watchGroup(['location', 'radius', 'excludeMeeting'], function(values) {
                    if (!values[0] || !values[1])
                        return;

                    localMeetingService.search($scope.location, $scope.radius, $scope.count).then(function (meetings) {
                        $log.log('localMeeting: Local events', meetings);
                        meetings = _.filter(meetings, function(meet) {
                            return meet.meetingId != $scope.excludeMeeting;
                        });

                        // get meetings info
                        meetingService.getInfo(meetings).then(function(meetingsInfo) {
                            var results = _.map(meetingsInfo, function(info) {
                                info.type = types[info.where.type] ? types[info.where.type] : 'Establishement';
                                info.url = meetingService.getSharingUrl(info.id);
                                return info;
                            });

                            $scope.meetings = results;
                        });
                     });
                });
            }]
        }
    });
})();
