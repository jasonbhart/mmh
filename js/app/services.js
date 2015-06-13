;(function() {
    "use strict";

    var app = angular.module('mmhServices', []);

    app.factory('geoLocation', ['$window', '$q', function($window, $q) {
        return {
            getLocation: function(options) {
                var defer = $q.defer();
                
                if ($window.navigator.geolocation) {
                    $window.navigator.geolocation.getCurrentPosition(
                        function(position) {        // success
                            defer.resolve(position);
                        }, function(error) {     // error
                            defer.reject(error);
                        }, options
                    );
                } else {
                    defer.reject('GeoLocation is not available');
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
                    if (status == google.maps.GeocoderStatus.OK) {
                        defer.resolve(result);
                    } else {
                        defer.reject(status);
                    }
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
                                    locality = acomps[0].short_name;
                                    break;
                                }
                            }
                        }
                        
                        if (locality) {
                            defer.resolve(locality);
                        } else {
                            defer.reject('Locality doesn\'t exist');
                        }
                        
                    }, function(error) {
                        defer.reject(error);
                    }
                );
        
                return defer.promise;
            },
            
            getCurrentLocality: function() {
                var service = this;
                var defer = $q.defer();
                this.getLocation().then(function(position) {
                    service
                        .getLocality(position.coords.latitude, position.coords.longitude)
                        .then(defer.resolve, defer.reject);
                }, defer.reject);
                
                return defer.promise;
            }
        };
    }]);
})();
