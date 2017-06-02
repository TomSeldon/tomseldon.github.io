---
layout: post
title:  "Unit testing in Angular: Behaviour over Implementation"
date:   2014-10-15 09:00:00 +0100
categories: javascript testing angular
---
I was recently introduced to an excellent talk on unit testing ([*"TDD: Where did it all go wrong"- Ian Cooper*][tdd-where-did-it-all-go-wrong]) that made me re-think the way I'd been writing tests. I'm not going to repeat all of the main points of the talk ad verbatim, instead you should just go and watch it. ;) Seriously. The hour it takes to watch can easily be recouped in the more resilient tests that you'll be writing.

What I *am* going to talk about is how I implemented this approach in Angular, with a comparison of this approach and the more traditional way of writing tests.

Before continuing, a very quick summation of what is trying to be achieved (but don't forget that first paragraph, go watch that talk!):

* Test behaviour, not implementation. That is, a unit of *behaviour*, rather than a unit of *code* (e.g. a class method).
* Lightly coupled tests. Changing implementation (e.g. refactoring) shouldn't require you to change your tests.
* Test with an *'outside in'* approach, i.e. your tests should have *no knowledge of your app internals* and instead should test the boundaries of the system.

Let's see how this might look for a typical Angular controller. In this example, it's for a controller in a chat application that exposes some properties and methods to a view partial, but relies on a service (`MessageService`) to provide the actual functionality.

Firstly, the controller:

{% highlight javascript %}
'use strict';

/**
 * Exposes chat functionality to a view partial.
 *
 * @param {MessageService} MessageService
 * @constructor
 */
var ChatController = function(MessageService)
{
    /** 
     * @type {MessageService}
     * @private
     */
    this.messageService_ = MessageService;
    
    /** 
     * @type {Array=}
     */
    this.transcript = MessageService.getTranscript();
};

/**
 * @param {string} message
 */
ChatController.prototype.sendMessage = function(message)
{
    this.messageService_.sendMessage(message);
};

/**
 * Exposes some presentation logic to the view,
 * allowing us to do nice things like adding a class
 * to a form field if the message in invalid.
 *
 * @param {string} message
 */
ChatController.prototype.isValidMessage = function(message)
{
    return this.messageService_.validateMessage(message);
};
{% endhighlight %}

The format of that may be different to what you're used to, but the underlying job it's doing is (or at least should be) the same. It contains no business logic itself, but exposes just what's necessary to the view.

So, what's the *normal* (and I use that term very loosely) way of testing this?

You've probably seen something similar to this:

{% highlight javascript %}
'use strict';

describe('Chat controller', function() {
    var chatController;
    var mockMessageService;
    
    beforeEach(module('myChatApp'));
    
    beforeEach(inject(function($injector) {
        var $controller = $injector.get('$controller');
        
        mockMessageService = {
            getTranscript: jasmine.createSpy(),
            sendMessage: jasmine.createSpy(),
            validateMessage: jasmine.createSpy()
        };
        
        chatController = $controller(
            'ChatController',
            {
                MessageService: mockMessageService
            }
        );
    }));
    
    describe('retrieving the chat transcript', function() {
        it('should fetch the chat transcript on instantiation', function() {
            expect(mockMessageService.getTranscript)
                .toHaveBeenCalled();
        });
    });
    
    describe('sending messages', function() {
        it('should be able to send messages', function() {
            chatController.sendMessage('Woah there');
            
            expect(mockMessageService.sendMessage)
                .toHaveBeenCalledWith('Woah there');
        });
        
        it('should expose a method for checking the validity of a message', function() {
            chatController.isValidMessage('');
            
            expect(messageService.validateMessage)
                .toHaveBeenCalledWith('');
        });
    });
});
{% endhighlight %}

Look familiar? It's what you'll see in most Angular unit testing examples (following the same ethos you'll find regardless of language or framework).

And it works! You get a high confidence that, well, your controller is calling a service with the expected input.

Now, and bear with me here, it turns out that after looking at `MessageService`, it was a bit of a mess. It was doing far too much and to so we decided to refactor it into two separate services; one for dealing with the sending and receiving of messages, and another just for validation.

So, we now have to change how the above controller is implemented. It may look something like this:

{% highlight javascript %}
/**
 * Exposes chat functionality to a view partial.
 *
 * @param {MessageService} MessageService
 * @param {ValidationService} ValidationService
 * @constructor
 */
var ChatController = function(MessageService, ValidationService)
{
    /**
     * @type {MessageService}
     * @private
     */
    this.messageService_ = MessageService;
    
    /**
     * @type {ValidationService}
     * @private
     */
    this.validationService_ = ValidationService;
    
    /**
     * @type {Array}
     */
    this.transcript = MessageService.getTranscript();
};

/**
 * @param {string} message
 */
ChatController.prototype.sendMessage = function(message)
{
    this.messageService_.sendMessage(message);
};

/**
 * Exposes some presentation logic to the view,
 * allowing us to do nice things like adding a class
 * to a form field if the message in invalid.
 *
 * @param {string} message
 */
ChatController.prototype.isValidMessage = function(message)
{
    return this.validationService_.validateMessage(message);
};
{% endhighlight %}

That's not hugely different, right? It's a straightforward refactor, with the key point that the methods and properties it exposes are the same as before.


But our tests are now failing. We've relied heavily on binding our tests to minor implementation details and with this simple controller refactor, we have to duplicate the effort (or more!) to 'fix' our tests as well.

It's not really a big deal in this trivial example, but in a real application where there is more than just a simple controller under test, this approach **will** result in a high level of technical debt.

So, how could the unit test have been written to avoid this issue?

{% highlight javascript %}
'use strict';

describe('Chat controller', function() {
    var chatController;
    var $httpBackend;
    
    beforeEach(module('myChatApp'));
    
    beforeEach(inject(function($injector) {
        var $httpBackend = $injector.get('$httpBackend');
        var $controller = $injector.get('$controller');
        
        chatController = $controller('ChatController');
    }));
    
    describe('retrieving the chat transcript', function() {
        it('should fetch the chat transcript on instantiation', function() {
            expect(chatController.transcript)
                .toEqual(jasmine.any(Array));
        });
    });
    
    describe('sending messages', function() {
        it('should be able to send messages', function() {    
            $httpBackend.expectPOST(
                '/api/message',
                'Woah there'
            ).respond(200);
            
            chatController.sendMessage('Woah there');
            
            $httpBackend.flush();
        });
        
        it('should add a sent message to the transcript', function() {
            chatController.sendMessage('foo');
            
            expect(chatController.transcript)
                .toContain('foo');
        });
        
        it('should expose a method for checking the validity of a message', function() {
            var invalidMessage = null;
            var validMessage = 'Hi!';
            
            expect(chatController.isValidMessage(invalidMessage))
                .toBe(false);
            
            expect(chatController.isValidMessage(validMessage))
                .toBe(true);
        });
    });
});
{% endhighlight %}

*...and breathe*. Let's go over the main differences. 

#### No mocked dependencies

The first and hopefully most noticeable is that we aren't mocking and specifying the dependencies of the controller under test. We're instantiating a controller and letting Angular handle injecting *real* instances of its dependencies. 

We're testing behaviour that this specific boundary  of our application exposes, so it should test the real system!

#### Err.. Well apart from that one
Secondly... you may have noticed we are in fact mocking one dependency, `$httpBackend`. Isn't this just a re-hash of the first example? *Nope.* Remember we're dealing with the inputs and outputs of the system- this is an output and so we *do* care about that, we just shouldn't be concerned with what goes on in the middle.

In this case, we know that the expected output of sending a valid message is that a HTTP POST request is made with specific parameters. We don't want to make a real HTTP request (that's for integration tests), so we stub the `$http` service (which is called 'somewhere' in the application).

#### Less boilerplate
Our test now contains a *lot* less boilerplate code that previously dealt with setting up and mocking dependencies. It's both quicker to write as well as being more durable.

#### More tests!
By removing mocks, we can write more meaningful tests ("more meaningful" both in terms of the number of tests as well as improving the quality of the existing ones).

We can test that when we perform an action (e.g. sending a message) that should result in an eventual update to the controller (e.g. updating the chat transcript), that it actually works! With mocked dependencies, that becomes much more difficult and even more brittle.

#### Refactor Proof™
I think I've stretched this chat application example as far as it will go, but let's say we needed to further ~~butcher~~ refactor our application, assuming we're not changing functionality, the tests can remain the same.

This is the **main point** of all of this. Our tests are now decoupled from implementation and we can rewrite our app internals all day long and know that if a test fails, it's because we genuinely screwed up and not because the tests are simply "out of date".

-------

### Conclusion

Hopefully I've demonstrated the usefulness of this approach in the context of an Angular app (though as mentioned, it's by no means specific to Angular).

Are there any areas where this approach doesn't quite work? After discussing this with colleagues, we came to the conclusion that *yes*, there probably are some situations where this isn't suitable, but they should be in the minority and any such 'implementation tests' should be treated as throw-away tests that will change and break as your application develops. 

I can't give as complete an explanation as I'd like on what these kind of scenarios are, though it is worth the consideration that they can present themselves and should be handled appropriately.

As mentioned in the very first paragraph, for me this a very different way of writing unit tests and I can see a lot of merit in it. I'd be very interested to hear any opinions to the contrary, or perhaps to flesh out my previous point of this perhaps not being the most appropriate method in 100% of cases.

[tdd-where-did-it-all-go-wrong]: http://vimeo.com/68375232
