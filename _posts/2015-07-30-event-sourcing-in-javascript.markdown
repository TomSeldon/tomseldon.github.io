---
layout: post
title:  "Event Sourcing in Javascript: What, why and how"
date:   2015-07-30 09:00:00 +0100
categories: javascript testing
---
It's a concept I've seen mentioned or used in many server-side languages and examples, and the idea is a simple one: re-building the state of an object in memory through the events that we know have occurred. Despite it being an idea that is by no means new and one that seems quite popular in server side applications, it's something that I've not really come across when the topic at hand is much more front-end oriented.

Why is that? My gut reaction, and that of some of my coworkers, is that it should be the job of the server to prepare any models (or view-models) that the front-end needs to render and so it's not necessarily something you should see running in the browser.

However, I recently worked on a large single page application (SPA) where it became clear quite quickly that relying on the server to prepare a *dumb object* just wouldn't have been practical and actually had some major drawbacks. We ended up implementing an event sourced solution that involved the server exposing the stream of events which then run on the client side, and TL;DR - it worked really well.

This blog post explores a real world use case that demonstrates how these impracticalities and drawbacks can manifest themselves and why using event sourcing on the client side can alleviate a lot of these issues. It's *not* all roses, though. The added complexity (or even perceived complexity), the potential performance impact of doing this work in the browser and just simply whether your application is an appropriate target for this methodology are all things that should be considered *as early on in development as possible*. 

Take my word for it: converting an existing, complex app to use event sourcing can be a confusing, hair tearing experience that can leave you reaching for the Ibuprofen and wondering whether software development really was the best career choice.

## The use case
So, what was this use case where just creating and serving up the view-model on the server just wouldn't do?

Imagine a fairly bog standard live chat application: a chat widget on a web page where the user can talk to other participants. We receive new instant messages (IMs) via web sockets, long polling or some other method and add it to the transcript shown to the user. So far so simple.

Now imagine that aside from the normal chat IMs that would build up a transcript, you also have various features such as video chat (and the associated upgrade, downgrade, acceptance and rejection) that are all also handled via the same message system as IMs, which is to say we send and receive these requests via some message transport to other chat participants.

Suddenly, we're not dealing with isolated messages anymore. The order of the messages, or message flow, becomes critical. We might request an upgrade from a text chat to video chat, which another party can accept or reject. This is a stateful system of messages that we need to react to in our front-end app to show the appropriate state, prompts, etc.

Now, add more features. Add more of these stateful message flows. Now note that some of these message flows can overlap as they can happen independently of each other, but also that some *are* dependent or are at least affected by one another.

Put a bit more simply: Our 'chat' all boils down to a complex set of state machines that can have an invariably large number of possible configurations.

Because of the nature of the app, we're dealing with sending and receiving individual messages in real time and updating the state of our chat model based on those messages. So, where each message has a known *'message type'* (such as an `IM` or a `VIDEO_UPGRADE_REQUEST`), we'll have an appropriate event handler for that type where we'll do *something* in reaction to it.

So, we have a system that is heavily event driven, but I've still not mentioned where event sourcing slots in.

### The curve ball...

So, in one of the first sentences describing this use case I said something you may have overlooked. It's a chat widget, on a web page. *A web page*. These things tend to be refreshed, and users have been known to move around to *different* web pages on a single site. It'd be nice if we could stop them doing that, and life would be so much simpler right up until the moment you're lynched by a mob of UXers.

So, we've got our complex, event driven front-end application. We now have a requirement that we need it to show in the exact same way, in the exact same state when a visitor navigates to another page or triggers a full page reload.

It sounds like such a *basic* requirement, it's so obvious! But looping back to what I said earlier about identifying these requirements up front and planning for them accordingly... turns out that's quite important.

I think the feelings of the entire team at this point can be summed up by Steve Harvey more concisely than I could ever manage:

![Steve Harvey gives up]({{ site.url }}/assets/images/steve-harvey-give-up.gif)

## *"Maybe we should just start again"*

Let's take a step back and remember the point of the original question I asked: *Given we have an application whose state is entirely composed of it's events, why not just use the server to rebuild the state and expose the result to the front-end?*

Well, in simpler systems the above is probably the more architecturally correct way of doing things.

In our case, what exactly *would* we expose to the front-end? We need to know the transcript, that's an easy one. We could just return all of the messages with type `IM`. Is the chat a text chat, or video chat? Is it pending an upgrade to video chat? How about to two-way video chat? We now have to look through the flow of messages on the server side to determine the answer to those questions.

Alternatively, as the messages are flowing back and forth in real time, the server could keep track of the state of the application with a basic set of flags:

* Is this a text chat?
* Is this a video chat?
* Is this a text chat pending an upgrade to video chat?
* Is this a video chat pending an upgrade to two-way video chat?
* etc.

That's fine too, but it can get out of hand extremely quickly due to the sheer number of different flags and their possible combined values.

Both of these methods, and in fact however you were to handle exposing the state in a "*simple way"* from the server side, means that you need additional code on the front-end to handle rebuilding state over the regular, 'real time' handlers for the same message types. From that point on, you've increased the work load for every new message and potentially every new feature. That's not a trivial point.

An even simpler solution than both of the above could be to serialize the object on the client side and store it using LocalStorage or similar. It can simply be deserialized on refresh/changing page and you can just carry on from where you left off. That's not so terrible, but it has it's own problems. There's always the potential for missed messages, for the chat getting into a state inconsistent with that of the other participants or the server. By relying absolutely on our local representation of the chat, we open ourselves up to a world of hurt.

### Oh wait, that's not so bad...

Whichever way you look at it, handling the rebuilding of state differently to how you handled how you got into that state in the first place is going to require more work. More work both in terms of the up-front effort to deal with the existing scenarios but also the on-going increase in work load of when new scenarios are added.

*If only there was a way of replaying past events so we could get back to the state we were in...*

**That's all event sourcing is.** We add a bit of code to go and request the events on page load and if there *are* any we can pipe them through our application as though they were live events we were receiving in real time. Aside from the small snippet of code responsible for getting the events and punting them through the app, everything else stays the same. Our application need not know that the event (or message) it's handling is a real time or historic event.

The end result being: We have a single way of handling a given event whether it's received in real time or a historic event, a single thing to maintain in each case. We can 'replay' a given set of events and the application will work itself out into the exact state it was in when in handled those events the first time.

This reduces the complexity of the code base, improves maintainability (try remembering that you need to update how you handle a feature in two completely separate places six months down the line), treats the server as the single source of truth for the state of the chat, and my personal favourite: **massively improves testability**.

The gain in testability comes from the ability to drive the app from a given stream of events. Should we need to be in a specific state to run our tests, we can create simple mocks of the event objects that would occur in the wild and just pipe them through the app. It gives a very high confidence that application is in a state that is absolutely representative of the one you'll see in production.

The other huge plus relates to debugging. If you come across some odd behaviour when running the app, reproducing it can be as simple as looking at the stream of events that got you into that state and then creating a test that uses that same stream of events to replicate the issue in a controlled environment. That pairs up very well with following TDD practices to resolve the issue, as you now have the application in an incorrect state, you can write tests that show the failure and work to get them green.

So, hopefully I've made the point about how useful an event sourced solution can be on the client side. But what are the draw backs?

#### I have to do what?!
The ability to rebuild state through events relies explicitly on the separation of handling actions (or intent) and the resultant events. Err, what?!

Take for example, sending an IM. Normally this might look something like:

{% highlight javascript %}
Chat.prototype.sendMessage = function(message) {
  // Store the message on the transcript
  this.transcript.push(message);
  
  // Send the message via some message transport
  this.messageBus_.sendMessage(message);
};
{% endhighlight %}

There's nothing especially wrong with doing this. But we've blurred the line of what we want to do when we want to *send* a message and what we want to do when one has been *sent*.

What happens when we want to replay a message? We can't use the event to somehow call this same function, because we'd end up just sending *another* message.

So, take this simplified example of how you could split this out.

{% highlight javascript %}
// where `chat` is an instance of a `Chat` object
chat.sendMessage('Hi there!');
chat.releaseEvents();
{% endhighlight %}

Woah, what's going on here? What's this *releaseEvents* thing all about? First, take a look through the below example code and then I'll explain it in more detail.

{% highlight javascript %}
/**
 * @param {MessageBus} messageBus
 *
 * @constructor
 */
function Chat(messageBus) {
  /**
   * Service for sending messages
   * 
   * @private
   */
  this.messageBus_ = messageBus;
  
  /**
   * Temporary store of events to handle
   * 
   * @private
   */
  this.events_ = [];
  
  /**
   * Transcript of chat IMs
   */
  this.transcript = [];
}

/**
 * @param {string} message
 */
Chat.prototype.sendMessage = function(message) {
  var sentImEvent = new SentImEvent();
  
  sentImEvent.messageBody = message;
  
  // Send the message on to the server
  this.messageBus_.send(sentImEvent);
  
  // Store the event in memory until we're ready
  // to handle it
  this.record_(sentImEvent);
};

/**
 * Loop through any stored events, call the appropriate
 * handler and then clear the recorded events.
 */
Chat.prototype.releaseEvents = function() {
  var i;
  var event;
  var numEvents = this.events_.length;
  
  // Loop through all stored events
  for (i = 0; i < numEvents; i++) {
    event = this.events_[i];
    
    // Pass the event to it's event handler
    this.when_(event);
  }
  
  this.events_ = [];
};

/**
 * @param {object} event
 * @private
 */
Chat.prototype.record_ = function(event) {
  this.events_.push(event);
};

/**
 * @param {SentImEvent|ReceivedImEvent} event
 * @private
 */
Chat.prototype.whenSentOrReceivedIm_ = function(event) {
  // Add the message to the transcript
  // You'd probably want to do something more complex than
  // just adding the string value of the IM, such as the recipient,
  // sender, etc.
  this.transcript.push(event.messageBody);
};

/**
 * @param {object} event
 * @private
 */
Chat.prototype.when_ = function(event) {
  // Map of message types to event handlers
  var handlers = {
    IM: this.whenSentOrReceivedIm_
  };
  var handler;
  
  handler = handlers[event.type];
  
  if (handler) {
    handler(event);
  }
};
{% endhighlight %}

With admittedly a lot more code, we've effectively split out the registering of *intent to perform an action*, and the state mutation that follows from *when an action is performed*.

The first (`sendMessage`) creates an event object that, based from its type, we can tell it means *"a message has been sent"*. We then store the actual message text as a property on the event object.

The event is then stored in memory on the Chat object, where it stays until we call `releaseEvents`.

This then cycles through any stored events and calls the appropriate handler for each event type, in this case that's `whenSentOrReceivedIm_`.

Now we're into handling what we want to actually happen when a message is received.

In a more typical, server-side implementation of event sourcing this event would then be persisted to an event store, where it can be requested and replayed as needed.

As a side note, it's also worth mentioning that the above approach lends itself very well to the command handler pattern as it is an even greater step in separating out intent and implementation. That's probably a bit over-complicated for the purposes of this example, but if you're planning on implementing something similar then I'd highly recommend it as something you should consider.

The above example shows how a chat IM can be split out into the intent and result, however the principle is the same whether for isolated events such as an IM or an event that is part of a stateful message flow. For example:

`acceptChat` becomes `acceptChat` and `whenAcceptedChat` for exactly the same reasons.

There are parts of the implementation deliberately left out of the code examples here, simply for brevity. However the general flow through the system can be summed up as:

#### Incoming events

* An event is received via some message transport.
* We pass the the event to the Chat object and allow it to work out what to do with it (`chat.handle(event)`).
* The Chat inspects the event type and looks up an appropriate handler.
* If a handler is found (e.g. `CHAT_IM => this.whenSentOrReceivedIm`) then the handling of the event is delegated to that handler.
* The handler uses the event and its properties to update the state of the Chat.

#### Outgoing events

* The chat participant triggers an intent. For this example, they've typed out a new message and hit send.
* We call `chat.sendMessage` with the text the user entered.
* We send the message via a message transport.
* Finally, we call `chat.releaseEvents()` so we can update the state of the chat.

#### Rebuilding state

The final piece of the puzzle is found when we need to rebuild the state of the Chat from scratch. So far I've shown how the application can be driven in real-time using events, but what about on page reload, or error-recovery, or whatever other reason you need to rebuild state. That was the whole point of this, right?

{% highlight javascript %}
function rebuildState() {
  // Look up the ID of the chat we were in
  // from local storage or similar
  var chatId = getChatId();
  var events;
  var eventsCount;
  var i;
  
  // If we had a previous chat, get the events for it.
  if (chatId) {
    // Load array of events from the 
    // server for the given chat ID
    events = getChatEventsFromServer(chatId);
    eventsCount = events.length;
    
    // Loop through the chat events
    // and tell the Chat to handle it
    for (i = 0; i < eventsCount; i++) {
      chat.handle(events[i]);
    }
  }
}
{% endhighlight %}

There's some fairly large implementation holes there. But as almost pseudo-code (*pseudo-pseudo-code?*), it shows the general flow involved in starting from scratch and using the server's event store to rebuild the chat.

Implementation wise, this is by no means the *only* way of accomplishing this kind of system, or necessarily the best way. But looking past the implementation detail here, hopefully you can see the power and usefulness of an approach such as this as a means of working with a complex, event driven system.

TL;DR event sourcing is awesome, but sometimes software development is hard.
