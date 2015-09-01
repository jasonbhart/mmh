;(function() {
    "use strict";

    var app = angular.module('mmh.services');
    
    app.factory('dataProvider', ['$q', '$http', '$log', function($q, $http, $log) {
        return {
            convertMilesToKms: function(miles) {
                return miles * 1.609344;
            },
            
            getTerms: function() {
                return [
                    { id: 'restaurants', name: 'Restaurants' },
                    { id: 'food', name: 'Food' },
                    { id: 'nightlife', name: 'Nightlife' },
                    { id: 'shopping', name: 'Shopping' },
                    { id: 'bars', name: 'Bars' },
                    { id: 'american-new', name: 'American (New)' },
                    { id: 'breakfast-brunch', name: 'Breakfast & Brunch' },
                    { id: 'coffee-tea', name: 'Coffee & Tea' },
                    { id: 'beauty-spas', name: 'Beauty & Spas' },
                    { id: 'health-medical', name: 'Health & Medical' },
                    { id: 'home-services', name: 'Home Services' },
                    { id: 'automotive', name: 'Automotive' },
                    { id: 'local-services', name: 'Local Services' },
                    { id: 'event-services', name: 'Event Planning & Services' },
                    { id: 'arts-entertainment', name: 'Arts & Entertainment' },
                    { id: 'active-life', name: 'Active Life' },
                    { id: 'hotels-travel', name: 'Hotels & Travel' },
                    { id: 'pets', name: 'Pets' },
                    { id: 'professional-services', name: 'Professional Services' },
                    { id: 'local-flavor', name: 'Local Flavor' },
                    { id: 'education', name: 'Education' },
                    { id: 'public-government', name: 'Public Services & Government' },
                    { id: 'real-estate', name: 'Real Estate' },
                    { id: 'financial-services', name: 'Financial Services' },
                    { id: 'mass-media', name: 'Mass Media' },
                    { id: 'religious-organizations', name: 'Religious Organizations' }
                ];
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
                    
                    if (options.term)
                        searchOptions.term = options.term;
                    // search offset, default 0.
                    if (options.offset) {
                        searchOptions.offset = options.offset;
                    }
                    // search limit - number of fetch items upon cliking show more
                    if (options.limit) {
                        searchOptions.limit = options.limit;
                    }
                    
                    // sort result
                    if (options.sort) {
                        searchOptions.sort = options.sort;
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
                            'rating': data.businesses[i].rating,
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
