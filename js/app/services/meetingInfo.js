;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.factory('meetingInfo', ['$q', '$log', 'dataProvider', 'meetingService', 'localMeetingService', 'userService',
            function($q, $log, dataProvider, meetingService, localMeetingService, userService) {

        var types = {};
        _.forEach(dataProvider.getTerms(), function(term) {
            types[term.id] = term.name;
        });

        var service = {
            getTypeName: function(type) {
                return type = types[type] ? types[type] : 'Establishement';
            },
            /**
             * @returns {Object} information about the latest meeting
             */
            getLatest: function() {
                var defer = $q.defer();
                meetingService.getLatestId().then(function(id) {
                    $log.log('meetingInfo: latest event id', id);
                    meetingService.getInfo({ meetingId: id }).then(function(meetingInfo) {
                        meetingInfo = meetingInfo[id];

                        if (!meetingInfo) {
                            defer.reject();
                            return;
                        }

                        var deferreds = [];
                        // get user photos
                        _.forEach(meetingInfo.users, function(id) {
                            var defer = $q.defer();
                            userService.get(id).then(function(user) {
                                defer.resolve(user.getProfileImageURL());
                            }, function() {
                                defer.resolve();
                            });
                            deferreds.push(defer.promise);
                        })

                        $q.all(deferreds).then(function(images) {
                            images = _.filter(images);
                            meetingInfo.type = service.getTypeName(meetingInfo.where.type);
                            meetingInfo.usersCount = images.length;
                            meetingInfo.userImages = images;
                            defer.resolve(meetingInfo);
                        });
                    });
                }, function() {
                    defer.reject();
                });

                return defer.promise;
            },
            /**
             * Returns information about [count] local meetings [coord, radius] excluding ids [exclude]
             * @param {Object} options {coord: {lat: float, lng: float}, radius: (in km), count: int, exclude: []}
             * @returns {promise}
             */
            getLocal: function(options) {
                var defer = $q.defer();

                localMeetingService.search(options)
                        .then(function (meetings) {
                    $log.log('meetingInfo: Local events', meetings);
                    if (options.exclude) {
                        meetings = _.filter(meetings, function(meet) {
                            return options.exclude.indexOf(meet.meetingId) == -1;
                        });
                    }

                    // get meetings info
                    meetingService.getInfo(meetings).then(function(meetingsInfo) {
                        var results = _.map(meetingsInfo, function(info) {
                            info.type = service.getTypeName(info.where.type);
                            return info;
                        });

                        defer.resolve(results);
                    });
                });

                return defer.promise;
            }
        };
        
        return service;
    }]);
})();
