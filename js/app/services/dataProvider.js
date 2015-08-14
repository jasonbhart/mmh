;(function() {
    "use strict";

    var app = angular.module('mmh.services');
    
    app.factory('dataProvider', ['$q', '$http', '$log', function($q, $http, $log) {
        return {
            convertMilesToKms: function(miles) {
                return miles * 1.609344;
            },
            
            /*
             * options = {
             *  location: "location name",
             *  OR
             *  coords: {
             *      lat: number,
             *      lng: number
             *  },
             *  
             *  radius: "number in kms"
             * }
             */
            getSuggestions: function(options) {
                var searchOptions = {};

                if (options) {
                    // location
                    if (options.location) {
                        searchOptions.location = options.location;
                    } else if (options.coords) {
                        searchOptions.coords = options.coords.lat + ',' + options.coords.lng;
                    }

                    // search radius
                    if (options.radius) {
                        // convert to meters
                        searchOptions.radius = options.radius * 1000;
                    }
                    // search radius
                    if (options.offset) {
                        // convert to meters
                        searchOptions.offset = options.offset;
                    }
                    // search radius
                    if (options.limit) {
                        // convert to meters
                        searchOptions.limit = options.limit;
                    }
                }

//                var xhr = $.getJSON('http://localhost:8080/', searchOptions);
                var xhr = $.getJSON('https://edgeprod.com:8081/', searchOptions);
                var defer = $q.defer();

                xhr.done(function(data) {
                    if (!data) {
                        defer.reject('Empty response');
                        return;
                    }

                    if (typeof(data) == 'string') {
                        try {
                            data = JSON.parse(data);
                            if (data.error && data.error.text)
                                defer.reject(data.error.text);
                            else
                                defer.reject('Unknown error');
                        } catch(e) {
                            defer.reject('Invalid response');
                        }

                        return;
                    }

                    var businessNames = Object.keys(data.businesses).map(function (key) { return data.businesses[key].name; });
                    var businessUrls = Object.keys(data.businesses).map(function (key) { return data.businesses[key].url; });
                    var businessRatingUrls = Object.keys(data.businesses).map(function (key) { return data.businesses[key].rating_img_url; });
                    var businessImageUrls = Object.keys(data.businesses).map(function (key) { return data.businesses[key].image_url; });
                    var businessDisplayAddress = Object.keys(data.businesses).map(function (key) { return data.businesses[key].location.display_address; });
                    var businessCities = Object.keys(data.businesses).map(function (key) { return data.businesses[key].location.city; });
                    var businessCountryCodes = Object.keys(data.businesses).map(function (key) { return data.businesses[key].location.country_code; });
                    
                    // initialize suggestions
                    var suggestions = [];
                    _.forEach(businessNames, function(e, i) {
                        var suggestion = {
                            'name': businessNames[i],
                            'url': businessUrls[i],
                            'rating_url': businessRatingUrls[i],
                            'image_url': businessImageUrls[i],
                            'display_address': businessDisplayAddress[i],
                            'city': businessCities[i],
                            'country_code': businessCountryCodes[i]
                        };
                        
                        if (data.businesses[i].distance)
                          suggestion.distance = data.businesses[i].distance;
                      
                        suggestions.push(suggestion);
                    });
                    defer.resolve(suggestions);
                }).fail(function(jqxhr, textStatus, error) {
                    $log.log('mmh.services:dataProvider:getSuggestions failed', textStatus, error);
                    defer.reject(textStatus);
                });
                
                return defer.promise;
            }
        };
    }]);
})();
