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
             *  coords: {
             *      lat: number,
             *      lng: number
             *  },
             *  radius: "number in kms"
             * }
             */
            getSuggestions: function(options) {
                var searchOptions = {};

                if (options && options.location) {
                    searchOptions.location = options.location;

                    if (options.coords && options.radius) {
                        searchOptions.coords = options.coords.lat + ',' + options.coords.lng;
                        searchOptions.radius = options.radius * 1000;
                    }
                }

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

                    // initialize suggestions
                    var suggestions = [];
                    _.forEach(businessNames, function(e, i) {
                        suggestions.push({
                            'name': businessNames[i],
                            'url': businessUrls[i],
                            'rating_url': businessRatingUrls[i]
                        });
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
