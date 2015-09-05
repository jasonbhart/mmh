;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.factory('geoLocation', ['$rootScope', '$window', '$q', '$log', function($rootScope, $window, $q, $log) {
        return {
            getLocation: function(options) {
                var defer = $q.defer();
                if ($window.navigator.geolocation) {
                    $window.navigator.geolocation.getCurrentPosition(
                        function(result) {
                            $rootScope.$applyAsync(function() {
                                defer.resolve(result);
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
            
            geoDecode: function(lat, lng) {
                var defer = $q.defer();
                var geocoder = new google.maps.Geocoder();
                var latLng = new google.maps.LatLng(lat, lng);
                geocoder.geocode({
                    latLng: latLng,
                }, function(result, status) {
                    console.log('geoDecode', lat, lng, result, status);
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
                        $log.log('geoLocation getLocality result success', result);
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
            
            getCurrentLocation: function(options) {
                var service = this;
                var defer = $q.defer();
                this.getLocation(options).then(function(position) {
                    service
                        .getLocality(position.coords.latitude, position.coords.longitude)
                        .then(function(locality) {
                            $rootScope.$applyAsync(function() {
                                defer.resolve({
                                    coords: locality.coords,
                                    shortName: locality.shortName
                                });
                            });
                        }, function() {
                            defer.reject();
                        });
                }, function() {
                    $rootScope.$applyAsync(function() {
                        defer.reject();
                    });
                });
                
                return defer.promise;
            }
        };
    }]);
})();
