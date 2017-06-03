---
layout: post
title:  "Debugging Office 365 add-ins: Baby steps in the right direction"
date:   2015-10-26 09:00:00 +0100
categories: javascript microsoft office365
---
I recently participated in an [Office 365 hackathon](http://angularconnect2015.devpost.com/) where I worked alongside [Christoph Körner](https://twitter.com/ChrisiKrnr) to create an add-in for Microsoft Word that can convert a document to markdown format. The idea being that non-technical content creators can write content in an environment they're familiar with and easily export it to a format suitable for GitHub, Bit Bucket, or to a blogging platform such as [Ghost](https://ghost.org/) (side note: this blog is powered by Ghost, and [this blog post was written with Microsoft Word](https://boxuk2-my.sharepoint.com/personal/tom_seldon_boxuk2_onmicrosoft_com/_layouts/15/guestaccess.aspx?guestaccesstoken=7dDNrABoLdfpmVOKT726SVijzRBAzqqyfc0Khud4hS0%3d&docid=0300456621fa4468795d8008ddcae87eb) and [the plugin was used to convert it to markdown!](https://en.wikipedia.org/wiki/Eating_your_own_dog_food)).

A quick overview for the uninitiated: Office 365 allows third-party developers to create mini-applications called "add-ins", written with HTML and JavaScript, that run within Office applications and have access to the running application (e.g. Word, Excel, etc.) via a JavaScript API.

This is great! It means front-end developers like myself can use our existing skills, tools and libraries we're used to (e.g. Angular) to quickly build useful features and enhancements.

## It's not working... I'll just open up dev tools and... Oh.

Sometimes, just sometimes, things don't always work first time. We can unit test our code, write functional tests, but things still slip through the net. For front-end dev, this usually means opening up dev tools in your browser of choice and using the tools at your disposal, such as breakpoints, scope inspection, or even simply viewing the errors or information that has been logged to the console.

When working on the markdown add-in I was viewing progress in Chrome and mocking the Office JavaScript APIs I'd be calling. It all seemed to go pretty smoothly... Ready for production, right?

I managed to get the development version of the add-in running in Microsoft Word, just to confirm it worked *for real*.* *It didn't. It didn't spectacularly explode, it just didn't seem to do anything. No problem, I thought. I'll just open up dev tools and... Oh.

![](http://i.imgur.com/Jav5Tq2.png)

No dev tools. No console to view. No chance!

Running in a sandboxed, black boxed environment such as this we can't even go old school and just *alert or console.log* our errors. So, how can you tell what's gone wrong? If you know roughly where the error is occurring, you could do something like write out the error to the page (it's what I ended up doing as I had a good idea of what was wrong and just wanted to confirm it). But being realistic, for proper development this just isn't workable.

## So, what's the solution?

I should note that if you're using Windows and Visual Studio, you're in luck. You can debug the Office add-in using Visual Studio. If, like me, you can't or won't use Visual Studio (perhaps personal preference, perhaps it doesn't exist in the OS you use) then things get a bit trickier.

For the online suite of Office applications you can still use Chrome dev tools, Firebug, etc. as it's just an IFrame embedded on the page. No real problems there. The problem arises when you need to debug your add-in when running in the desktop or mobile variant (and there is a need to debug these separately as there are differences in the exposed API).

Thankfully, there's another way. Enter [weinre](https://people.apache.org/~pmuellr/weinre-docs/latest/Home.html).

*"weinre is a debugger for web pages, like Firebug (for Firefox) and Web Inspector (for Web Kit-based browsers), except it's designed to work remotely, and in particular, to allow you debug web pages on a mobile device such as a phone."*

![](https://people.apache.org/~pmuellr/weinre-docs/latest/images/weinre-demo.jpg)

It's a bit dated now, but it's pretty good and whilst the original intent was to debug on mobile, in actuality the scenario isn't really that different to our problem.

This seems like a pretty good candidate, so let's give it a go!

## Setting up weinre with the add-in

For the most part, we're going to do exactly what the weinre documentation says to get setup here. In a nutshell, we're going to install weinre using NPM and start up the server. We're then going to add the target script to our `index.html` page, visit the debug client in our browser of choice and finally, start up the add-in and start debugging.

The slight difference to the standard weinre setup we need to make is born from the fact that weinre runs over HTTP with no option to use HTTPS. Office *requires* that any external content be loaded over HTTPS, meaning that if we stopped here and tried to run the add-in within Office it would never connect to our weinre server.

To work around this, we can use a reverse proxy to forward HTTPS traffic to our weinre server over HTTP. Luckily, something exists within Node and NPM for doing just that. I used a service called `ngrok` to do this, though in practice any reverse proxy should work (you could roll your own using Express, Nginx, etc. almost as easily).

Install weinre and ngrok:

`npm install -g weinre ngrok`

Run the weinre server:

`weinre`

Run the ngrok reverse proxy:

`ngrok http 8080`

*Where 8080 is the port your weinre server is running on.*

Add the instrumentation script to the add-in index.html. You wouldn't want to leave this here indefinitely, just for development. There are various tools available at build time such as Gulp or Grunt that can help you with that though, the details of which I won't go into in this post.

{% highlight html %}
<body>

<!-- the rest of your page / app -->

<script src="https://tq5p18ad.ngrok.io/target/target-script-min.js"></script>

</body>
{% endhighlight %}

Note that we haven't used a direct URL to the weinre server (which could be something like <http://localhost:8080/>) and we're instead pointing at the ngrok reverse proxy we setup in the previous step. The actual URL used will differ each time you run ngrok.

![](http://i.imgur.com/XEpP93A.png)

Next, open up the debug client by visiting http://localhost:8080/client (or the ngrok URL if the weinre server is running remotely) and finally, launch your add-in using Office.

You should now see your add-in show up in the debug client. You can view and modify the DOM tree, have access to an interactive console and can view network requests, web storage, etc.

![](http://i.imgur.com/p4HNjdD.png)

This isn't a fully featured debug client like Chrome dev tools or Firebug. In fact, far from it. You can't use breakpoints, can't drill down into individual source files to see what's being run and a lot else is missing, too. But it's definitely a baby step in the right direction towards being able to properly debug (and hence develop for) Microsoft Office.

Despite it not being the perfect solution, this has made developing for Office 365 **much, much easier** for me and I hope it helps you, too. Have you come across this issue? If you have, I'd love to hear if you approached it in a different (slightly less clunky!) way.