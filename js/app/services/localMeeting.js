;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.factory('localMeetingService', ['$rootScope', '$q', '$log', 'appConfig',
            function($rootScope, $q, $log, appConfig) {

        var refGEO = new Firebase(appConfig.firebaseUrl + '/localMeetsGEO');
        var localMeetsGEO = new GeoFire(refGEO);
        var localMeets = new Firebase(appConfig.firebaseUrl + '/localMeets');
        
        var service = {
            /**
             * @param {string} meetingId
             * @param {string} whereId
             * @param {Object} location { lat: float, lng: float }
             */
            add: function(meetingId, whereId, location) {
                var ref = localMeets.push({
                    meeting: meetingId,
                    where: whereId,
                    createdAt: moment().utc().toISOString()
                });
                
                $log.log('localMeetingsService: add key', ref.key());
                return $q.when(localMeetsGEO.set(ref.key(), [location.lat, location.lng]));
            },
            /**
             * @param {string} meetingId
             * @param {string} whereId
             */
            remove: function(meetingId, whereId) {
                var key = getKey(meetingId, whereId);
                $log.log('localMeetingsService: remove key', key);
                return $q.when(localMeetsGEO.remove(key));
            },
            /**
             * @returns {Object} latest added meeting/place
             */
            getLatest: function() {
                var defer = $q.defer();
                localMeets.limitToLast(1).once('value', function(snap) {
                    if (!snap.exists()) {
                        defer.reject();
                        return;
                    }

                    // get first value (meeting)
                    var value = snap.val();
                    var meeting;
                    for (var i in value) {
                        if (value.hasOwnProperty(i)) {
                            meeting = {
                                meetingId: value[i].meeting,
                                whereId: value[i].where
                            }
                            break;
                        }
                    }

                    defer.resolve(meeting);
                });

                return defer.promise;
            },
            /**
             * @param {Object} options {coord: {lat: float, lng: float}, radius: (in km), count: int, exclude: []}
             * @returns {promise}
             */
            search: function(options) {
                var defer = $q.defer();
                var deferreds = [];
                var ids = {};
                var query = localMeetsGEO.query({
                    center: [options.coord.lat, options.coord.lng],
                    radius: options.radius
                });

                query.on('ready', function() {
                    // wait for all meetings
                    $rootScope.$applyAsync(function() {
                        $q.all(deferreds).then(function(meetings) {
                            meetings = _.filter(meetings, function(meeting) {
                                return meeting && meeting.createdAt &&
                                       moment().diff(moment(meeting.createdAt)) < 86400 * 1000;
                            });                  // filter out empty values produces by resolve()
                            defer.resolve(meetings.slice(0, options.count));        // we can have more than limit because of deferreds
                        });
                    });
                    query.cancel();
                });

                query.on('key_entered', function(key, location, distance) {
                    if (_.keys(ids).length >= options.count)
                        return;

                    var meetDefer = $q.defer();
                    deferreds.push(meetDefer.promise);

                    localMeets.child(key).once('value', function(snap) {
                        if (!snap.exists()) {
                            $rootScope.$applyAsync(function() {
                                meetDefer.resolve();
                            });
                            return;
                        }

                        var value = snap.val();

                        // we already know about this meeting
                        if (ids[value.meeting]) {
                            $rootScope.$applyAsync(function() {
                                meetDefer.resolve();
                            });
                            return;
                        }

                        ids[value.meeting] = true;
                        var meeting = {
                            meetingId: value.meeting,
                            whereId: value.where,
                            createdAt: value.createdAt,
                            location: location,
                            distance: distance
                        };

                        $rootScope.$applyAsync(function() {
                            meetDefer.resolve(meeting);
                        });
                    });
                });

                return defer.promise;
            }
        };

        return service;
    }]);
})();
