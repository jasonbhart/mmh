;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.factory('geoLocation', ['$rootScope', '$window', '$q', '$log', '$http', '$timeout', 'appConfig', 'util',
            function($rootScope, $window, $q, $log, $http, $timeout, appConfig, util) {
        var service = {
            getPosition: function(options) {
                var defer = $q.defer();
                
                if ($.cookie('browserLocation')) {
                    try {
                        var browserLocation = JSON.parse($.cookie('browserLocation'));
                        defer.resolve(browserLocation);
                        return defer.promise;
                    } catch (e) {
                        console.log(e);
                    }
                }
                
                if ($window.navigator.geolocation) {
                    $window.navigator.geolocation.getCurrentPosition(
                        function(result) {
                            $rootScope.$applyAsync(function() {
                                var browserLocation = {coords: {latitude: result.coords.latitude, longitude: result.coords.longitude}}
                                $.cookie('browserLocation', JSON.stringify(browserLocation), {path: '/', expires: 0.007})
//                                result = {coords: {latitude: 45.53192069999999, longitude: -122.6986860000000}}
                                defer.resolve(browserLocation);
                            });
                        }, function(error) {
                            $rootScope.$applyAsync(function() {
                                defer.reject(error);
                            });
                        }, options);
                } else {
                    $rootScope.$applyAsync(function() {
                        defer.reject('GeoLocation is not available');
                    });
                }
                
                return defer.promise;
            },

            getPositionByIP: function() {
                var defer = $q.defer();
                
                if ($.cookie('ipLocation')) {
                    try {
                        var ipLocation = JSON.parse($.cookie('ipLocation'));
                        defer.resolve(ipLocation);
                        return defer.promise;
                    } catch (e) {
                        console.log(e);
                    }
                }
                
                $http.get(
                    util.joinPaths(appConfig.dataUrl, '/geoip'),
                    {
                        responseType: 'json'
                    })
                    .then(function(response) {
                        if (response.data == null) {
                            defer.reject('Unknown position');
                            return;
                        }
                        
                        $.cookie('ipLocation', JSON.stringify(response.data), {path: '/', expires: 0.05});
                        defer.resolve(response.data);
                    }, function(response) {
                        defer.reject(response.statusText);
                    });
                return defer.promise;
            },

            getCurrentPosition: function() {
                var defer = $q.defer();
                
                // will be resolved on timeout or on error (user denied browser detection)
                var errorDefer = $q.defer();

                var tmoutPromise = $timeout(angular.noop, appConfig.geoLocationTimeout);
                tmoutPromise.then(function() {
                    errorDefer.resolve('geoLocation timeout');
                });

                // first check browser detection
                this.getPosition().then(function(position) {
                    $timeout.cancel(tmoutPromise);
                    defer.resolve(position.coords);
                }, function(error) {
                    $timeout.cancel(tmoutPromise);
                    errorDefer.resolve(error);
                });

                // try to get position by ip
                errorDefer.promise.then(function() {
                    service.getPositionByIP()
                        .then(function(position) {
                            defer.resolve(position);
                        }, function(error) {
                            defer.reject(error);
                        });
                });

                defer.promise.then(function(position) {
                }, function(error) {
                    $log.log('getCurrentPosition error', error);
                });

                return defer.promise;
            },
            
            geoDecode: function(lat, lng) {
                var defer = $q.defer();
                var geocoder = new google.maps.Geocoder();
                var latLng = new google.maps.LatLng(lat, lng);
                geocoder.geocode({
                    latLng: latLng,
                }, function(result, status) {
                    $rootScope.$applyAsync(function() {
                        if (status == google.maps.GeocoderStatus.OK) {
                            defer.resolve(result);
                        } else {
                            defer.reject(status);
                        }
                    });
                });
                
                return defer.promise;
            },
            
            // city/town
            getLocality: function(lat, lng) {
                var defer = $q.defer();
                this.geoDecode(lat, lng).then(
                    function(result) {
                        var locality = null;
                        // find locality in the result
                        for (var i=0; i<result.length; i++) {
                            if (result[i].types && result[i].types.indexOf('locality') >= 0) {
                                var acomps = result[i].address_components;
                                
                                if (acomps && acomps.length > 0) {
                                    locality = {
                                        coords: {
                                            lat: lat,
                                            lng: lng
                                        },
                                        locality: _.first(acomps),
                                        country: _.last(acomps)
                                    };
                                    locality.shortName = locality.locality.short_name + ', ' + locality.country.short_name;
                                    break;
                                }
                            }
                        }

                        $rootScope.$applyAsync(function() {
                            if (locality) {
                                defer.resolve(locality);
                            } else {
                                defer.reject('Locality doesn\'t exist');
                            }
                        });
                    }, function(error) {
                        $rootScope.$applyAsync(function() {
                            defer.reject(error);
                        });
                    }
                );
        
                return defer.promise;
            },
            
            getCurrentLocation: function(forceUpdate) {           
                var defer = $q.defer();
                
                if ($.cookie('currentLocation') && !forceUpdate) {
                    try {
                        var location = JSON.parse($.cookie('currentLocation'));
                        defer.resolve(location);
                        return defer.promise;
                    } catch (e) {
                        console.log(e);
                    }
                    
                };

                this.getCurrentPosition().then(function(position) {
                    // get locality by position
                    service.getLocality(position.latitude, position.longitude)
                        .then(function(locality) {
                            var result = {
                                coords: locality.coords,
                                shortName: locality.shortName
                            };
                            $.cookie('currentLocation', JSON.stringify(result), {path: '/', expires: 0.05})
                            defer.resolve(result);
                        }, function() {
                            var result = {
                                coords: {lat: position.latitude, lng: position.longitude},
                                shortName: 'Unknown'
                            };
                            $.cookie('currentLocation', JSON.stringify(result), {path: '/', expires: 0.05})
                            defer.resolve(result);
                        });
                }, function(error) {
                    defer.reject(error);
                });
                
                return defer.promise;
            }
        };

        return service;
    }]);
})();
