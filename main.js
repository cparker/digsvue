var app = angular.module('multiView', [
    'ngSanitize',
    'ui.router',
    'com.2fdevs.videogular',
    'com.2fdevs.videogular.plugins.controls',
    'com.2fdevs.videogular.plugins.overlayplay',
    'com.2fdevs.videogular.plugins.poster',
]);

var formatDate = function(dateTime) {
    return moment(dateTime).format('MMM Qo h:mm a');
};

app.config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise('/current');

    $stateProvider
        .state('home', {
            url: '/home',
            templateUrl: 'partials/home.html',
            controller: 'AppCtrl'
        })
        .state('zone-details', {
            url: '/zone-details/{zoneName}',
            templateUrl: 'partials/zone-details.html',
            controller: 'ZoneDetails'
        })
        .state('play', {
            url: '/play/{videoURL}',
            templateUrl: 'partials/play.html',
            controller: 'Play'
        })
        .state('current', {
            url: '/current',
            templateUrl: 'partials/current.html',
            controller: 'Current'
        })

});

app.factory('dataService', ['$q', '$http', function($q, $http) {

    var eventsURL = '/events';

    // the current views of all zones
    var mockCurrentData = [{
        zone: "Front Door",
        imageURL: "test/test-cam-still-image.png",
        liveURL: "test/test-cam-still-image.png"
    }, {
        zone: "Garage",
        imageURL: "images/coming-soon.png",
        liveURL: "images/coming-soon.png"
    }, {
        zone: "Back Door",
        imageURL: "images/coming-soon.png",
        liveURL: "images/coming-soon.png"
    }];


    // history of one zone
    var mockFrontDoorEvents = {
        zone: "Front Door",
        current: {
            imageURL: "test/test-cam-still-image.png",
            liveURL: "test/test-cam-still-image.png",
            "dateTime": "2016-06-17T10:47:01-04:00"
        },
        history: [{
            "imageURL": "test/test-cam-still-image.png",
            "videoURL": "test/test-cam-video.mp4",
            "dateTime": "2016-06-17T10:47:01-04:00"
        }, {
            "imageURL": "test/test-cam-still-image.png",
            "videoURL": "test/test-cam-video.mp4",
            "dateTime": "2016-06-17T11:47:01-04:00"
        }, {
            "imageURL": "test/test-cam-still-image.png",
            "videoURL": "test/test-cam-video.mp4",
            "dateTime": "2016-06-17T12:47:01-04:00"
        }, {
            "imageURL": "test/test-cam-still-image.png",
            "videoURL": "test/test-cam-video.mp4",
            "dateTime": "2016-06-17T13:47:01-04:00"
        }]
    };

    // recent events across all zones
    var recentEvents = [{
        "zone": "Front Door",
        "history": [{
            "imageURL": "test/test-cam-still-image.png",
            "videoURL": "test/test-cam-video.mp4",
            "dateTime": "2016-06-17T13:47:01-04:00"
        }, {
            "imageURL": "test/test-cam-still-image.png",
            "videoURL": "test/test-cam-video.mp4",
            "dateTime": "2016-06-17T13:47:01-04:00"
        }]
    }, {
        "zone": "Garage",
        "history": [{
            "imageURL": "test/test-cam-still-image.png",
            "videoURL": "test/test-cam-video.mp4",
            "dateTime": "2016-06-17T13:47:01-04:00"
        }, {
            "imageURL": "test/test-cam-still-image.png",
            "videoURL": "test/test-cam-video.mp4",
            "dateTime": "2016-06-17T13:47:01-04:00"
        }, {
            "imageURL": "test/test-cam-still-image.png",
            "videoURL": "test/test-cam-video.mp4",
            "dateTime": "2016-06-17T13:47:01-04:00"
        }]
    }, {
        "zone": "Back Door",
        "history": [{
            "imageURL": "test/test-cam-still-image.png",
            "videoURL": "test/test-cam-video.mp4",
            "dateTime": "2016-06-17T13:47:01-04:00"
        }]
    }];

    var mockEventsByZone = function(zone) {
        return $q.when(mockFrontDoorEvents);
    };

    var mockRecentEvents = function() {
        return $q.when(recentEvents);
    };

    var mockCurrent = function() {
        return $q.when(mockCurrentData);
    };


    var someRealService = function() {
        return $http.get(someDataURL);
    };

    return {
        someRealService: someRealService,
        mockRecentEvents: mockRecentEvents,
        mockEventsByZone: mockEventsByZone,
        mockCurrent: mockCurrent
    };
}]);


app.controller('AppCtrl', ['$scope', '$interval', 'dataService',
    function($scope, $interval, dataService) {

        $scope.formatDate = formatDate;

        dataService.mockCurrent()
            .then(function(events) {
                $scope.events = events;
            });

    }
]);

app.controller('ZoneDetails', ['$scope', '$interval', 'dataService', '$state', '$log', '$stateParams',
    function($scope, $interval, dataService, $state, $log, $stateParams) {

        $scope.playVideo = function(event) {
            $log.info('playing', event);

            $state.go('play', {
                videoURL: event.videoURL
            });
        };

        $scope.formatDate = formatDate;

        dataService.mockEventsByZone($stateParams.zoneName)
            .then(function(events) {
                $scope.events = events;
            });

    }
]);

app.controller('Current', ['$scope', '$interval', 'dataService', '$state', '$log',
    function($scope, $interval, dataService, $state, $log) {
        $scope.selectZone = function(zone) {
            $state.go('zone-details', {
                zoneName: zone.zone
            })

        };

        dataService.mockCurrent()
            .then(function(feeds) {
                $log.debug('feeds', feeds);
                $scope.feeds = feeds;
            });



    }
]);


app.controller('Play', ['$scope', '$interval', 'dataService', '$sce', '$log', '$stateParams', '$timeout',
    function($scope, $interval, dataService, $sce, $log, $stateParams, $timeout) {

        $scope.videoURL = $stateParams.videoURL;
        $log.info('videoURL is', $scope.videoURL);

        $scope.playerReady = function(playerAPI) {
            this.api = playerAPI;

            var newSource = [{
                src: $sce.trustAsResourceUrl($scope.videoURL),
                type: 'video/mp4'
            }];

            this.api.changeSource(newSource);
            this.api.clearMedia();
            $scope.playerConfig.sources = newSource;
            /*
            console.log('config', this.api.config);
            console.log('sources', this.api.sources);
            console.log('isReady', this.api.isReady);
            console.log('mediaElement', this.api.mediaELement);
            */
            this.api.setState('play');
            $timeout(this.api.play.bind(this.api), 1000);
        };

        $scope.playerConfig = {
            sources: [],
            theme: 'bower_components/videogular-themes-default/videogular.css'
        };

        $scope.errorCallback = function(e) {
            $log.error('video error', e);
        };

        $scope.formatDate = formatDate;

        dataService.mockEventsByZone("frontDoor")
            .then(function(events) {
                $scope.events = events;
            });
    }
]);
