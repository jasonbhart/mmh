;(function() {
    "use strict";

    function UserGroupBuilder() {

        function buildMap(users, field) {
            var valuesMap = {};

            for (var i=0; i<users.length; i++) {
                var values = users[i][field];
                for (var j=0; j<values.length; j++) {
                    var item = values[j];
                    if (valuesMap[item] === undefined) {
                        valuesMap[item] = 0;
                    }

                    valuesMap[item]++;
                }
            }

            // convert map to list
            var result = [];
            _.forOwn(valuesMap, function(value, key) {
                result.push({
                    id: key,
                    count: value
                });
            });

            result.sort(function(a, b) {
                return b.count - a.count;     // desc sort
            });

            return result;
        }

        // build group with the biggest number of members
        function buildGroup(users) {
            var whereMap = buildMap(users, 'where');
            var where = {
                id: undefined,
                count: 0
            };
            var when = {
                id: undefined,
                count: 0
            };

            // loop through whereMap in desc order
            for (var i=0; i<whereMap.length; i++) {

                // get users for the current where value
                var whenUsers = _.filter(users, function(u) {
                    return u.where.indexOf(whereMap[i].id) >= 0;
                });

                var whenMap = buildMap(whenUsers, 'when');

                // the biggest count is on 0 index
                if (whenMap.length > 0 && whenMap[0].count > when.count) {
                    where.id = whereMap[i].id;
                    where.count = whereMap[i].count;
                    when.id = whenMap[0].id;
                    when.count = whenMap[0].count;
                }
            }

            var group = null;

            // here we have ids
            if (where.id && when.id) {
                var group = {
                    userIds: [],
                    location: users[0].location,
                    where: where,
                    when: when
                }

                group.userIds = _.map(
                    _.filter(users, function(u) {
                        return u.where.indexOf(where.id) >= 0
                            && u.when.indexOf(when.id) >= 0;
                    }), function(u) {
                        return u.userId;
                    }
                );
            }

            return  group;
        }

        // build all groups
        this.build = function (users) {
            var groups = []

            // for each group of users grouped by location ...
            _.forEach(
                _.values(
                    _.groupBy(users, function(u) {
                        return u.location ? u.location.shortName : null;
                    })
                ),
                function(users) {
                    while (users.length > 0) {
                        var group = buildGroup(users);

                        // this can happen when "where/when" fields are empty
                        if (!group)
                            break;

                        groups.push(group);

                        // filter out users that belong to just created group
                        users = _.filter(users, function(u) {
                            return group.userIds.indexOf(u.userId) < 0;
                        });
                    }    
                }
            );

            return groups;
        }
    }
    
    var app = angular.module('mmh.services');
    
    app.service('userGroupBuilder', UserGroupBuilder);
})();
