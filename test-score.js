require('dotenv').config();
const { scoreCall } = require('./scoring');

// ── ADD TEST TRANSCRIPTS HERE ─────────────────────────────
const TEST_CASES = [
  {
    label: 'Test 1 — Dubai Expat, Short Term',
    persona: 'Dubai Expat Parent',
    city: 'Chennai',
    area: 'KK Nagar',
    transcript: `AI: Hi. I'm actually actually based in Dubai, but I'm in Chennai for a few months. So I was looking for a short term preschool option for my son.
User: Yeah. We provide short term, uh, preschool options. Uh, how long are you looking at?
AI: Good. I need something for about 2 to 3 months. Can you do that without locking me into a long contract?
User: Yeah. Yeah. We can do that. So there is a short term plan in which you have to pay month by month, and you can extend as long as you want. There would be an upfront, uh, admission fee, and, uh, there would be, uh, a learning kit for which you'll have to pay. In this price, you also get live CCTV feeds. We can actually actually see what your little 1 is doing. You also get, food also depending on whether they're opting for preschool or daycare. You get, uh, either 1 wheel or you get food.
AI: Okay. Got it. That sounds good. The month to month flexibility and CCTV is what I wanted. What's the the teacher to child ratio in your classes?
User: So yeah. Excellent question. We maintain, uh, 1 is to 8 or 1 is to 10 teacher child ratio. That'll depend on the age. How old is your child?
AI: He's 3 years and 2 months. So which ratio would he fall into?
User: So we'll follow a ratio of 1 is to 10, and we follow so 1 teacher and 10, uh, student 10 kids plus there would be a daily. Uh, we follow HighScope curriculum and, uh, you know, fundamentally, we believe that 90 percent brain development happens by the age of 5. So if you look at, uh, science that says that most of the neurons get formed in the earlier. So the choice of curriculum is very important. We use HighScope, which is probably the only research based curriculum that exists in the early years. Uh, and it has a lot of proven data, so we use that
AI: Alright. I appreciate that. But then just to be clear, uh, I'm not worried about regression. Arian was in a good school in Dubai. So the curriculum is fine as long as it's decent. What I really need to know is can I visit the center tomorrow or the day after to see the setup myself?
User: Yeah. Yeah. I wanted you to, uh, yeah. So tell me what city and which location you are in. I'll book your visit.
AI: I'm in KK Nagashanai. So whichever center you have closest to that would work for me.
User: So I have a center which is, uh, right in Kekineagar. Let me book an appointment for 2 PM tomorrow work.
AI: Yeah. 2 PM tomorrow works. What's the address? And should I just walk in, or do I need to confirm? Anything beforehand?
User: Yeah. No. So I'm just booking you for, uh, 2 PM tomorrow. You will get a WhatsApp with complete address, Google link, and And again, if you are facing any problem, you can call us back or you can also chat on the WhatsApp. Uh, there is an agent always available, so we can we'll help you with that. Anything else I can help you today?
AI: No. That's good. I'll check out the center tomorrow and see how it looks. Thanks.
User: Thank you so much. Perfect.`
  },

  {
    label: 'Test 2 — Single Mother, Full Day Daycare',
    persona: 'Single Mother, Full Day Daycare',
    city: 'Unknown',
    area: 'Unknown',
    transcript: `AI: Hi. I wanted to understand if you have a day care facility for my 2 year old daughter. From morning till evening.
User: Yes. We do have. May I know what are the timing are you looking?
AI: Oh, okay. So, basically, I need to start from next month. My work timing is 9 to 6, so I would need her to be there by around 8 30 in the morning and then pick up by 6 in the evening. Is that possible with you?
User: It's while telling you our timing. Right? So our timing starts from 9 o'clock. Like, we do have early program. The timing would be 9 to 6 30. Monday to Friday. Apart from this, we have the time extension services where, like, you can drop your child by 8
AI: Okay.
User: Just your line. Okay?
AI: Yes. Yes. I am listening. So you have the early drop at 8. That's good. And then pick up till 6 30. That works for me, actually. But sorry 1 thing. Uh, I was actually wondering, uh, how do you handle the diaper situation? Because Aira is not potty trained yet. I just want to know if the staff will be okay with changing her regularly through the day.
User: Yes. Our stock like, is well trained, and they are, like, keep uh, checking the child's diaper. Right? And they are changing whenever it's required in a day. So they are keep checking it. So they do chain. We are taking care of the cleaning and then hygienic. And our teachers and the nanny are like, well trained, and time to time, they are getting the training and get certified on a lot of topics like, broadly, uh, cleanliness, hygiene, uh, how to take care of the child, how to handle the small kids, the how to deliver the curriculum activity part. Yes. So we do take care of it.
AI: Okay. That's good. I was just I mean, I worry, you know, because, uh, she's still in diapers, and I don't want staff to feel like it's too much work or anything. But if they're trained for it, that's that's actually reassuring. So 1 more thing. What about meals? Like, what what will she eat during the day? Does the center provide food, or do I need to send lunch from home?
User: K. So we provide meal from our side, and, fully, we provide 4 meals, breakfast, lunch, evening snacks, and fruits. So breakfast will be served around 10, 10 30. Lunch would be served around 12, 12 33 o'clock, we serve fruit and 5 o'clock, we serve snacks. It's all hundred percent of dishes, food, and vegetarian food. It is amissolite food. Right? And you will be getting the meal planner on our parent connect app where you can see what your child is going to have. Today, we provide no junk food, no chocolate, not chips. In the healthy foods, we will be having, like dance oh, sorry. The Upma Poha, Delhi, Bhagavali. So varieties of food would be there. And hundred percent nutritious food and vegetarian foods only.
AI: Okay. That sounds good. The meal sound healthy, Akhil. Actually, but sorry. 1 more thing. When she eats, like, who actually feeds her? Because she still needs help with the spoon sometimes. Does someone sit with her and help, or do the kids just eat on their own?
User: No. Definitely, the teacher will help to the child, right, in terms of reading. In terms of mail, and, uh, Didi would be also there on on office basis as per the requirement. So we will be feed the trial and time. And in a meanwhile, we will also make the trial learn how like, they will have the food.
AI: Okay. That's
User: So we will Okay.
AI: Sorry. I just want to make sure. So there's always someone sitting with her while she eats, like, 1 of the teachers or the nanny will be there to actually feed her and help her because she's still quite small, and I get worried if she's left alone with food. You know?
User: Yeah. Yeah. I do understand as a parent. So definitely, yes. We don't leave the kids alone. So there's someone who would be there. The teacher will feed the child and with the help of the nanny would be also there. Right? So we will properly feed the child. And in the meanwhile, we also, uh, make them learn, uh, how to, like, have a bill. By their own self. They will be getting learned, uh, slowly slowly and gradually. So, yes, we will feed the child properly. And you will be getting the update as well, where your child has eaten, how much quantity. Yes.
AI: Okay. That's good. That's really good, actually. So you'll send updates about what she ate and how much That's reassuring. So 1 more thing. Um, I was thinking about, like, how she'll settle into the center because, you know, she's been with me all the time. I don't want to just drop her on day 1 and have her cry the whole day. Can we do, like, a slow transition or something? Like, maybe start with a few hours first.
User: Yeah. So we do have proper settling policy. Right? Because, yes, we do also understand it will be the new place for the child. So in this settling policy, we allow both the parents when you the parents can come for the settling, and he will be sharing all details details with us about the child's day routine, liking, disliking, sign language, and slowly, slowly, gradually, we will increase her time here. So the settling would be there. It's minimum for a week depend on the child. So because every child is unique, so they are taking their own time. And, uh, if required, it's more than a week, the teacher will let you know. So, yes, we will having the proper, uh, settling period.
AI: Okay. That's really good to hear. A week sounds reasonable, and I like that you're saying it depends on the child because you know, every kid is different. So during this settling period, like, can I stay with her inside the class, or do I have to sit out I just want to know how it works exactly?
User: Okay. So what happened, like, in the first day, we will allow him to class into classroom. Second day, we'll, like, from the second day, you can sit at the reception area and and you can log in in your lap laptop, in your mobile. You can see the trial live. We will observe the trial If you feel the child is missing you, we will come to you. So it's it's stall like, the child will start, uh, engaging with other kids like, to feel safe and secure. So you will be at the center only in inside the center only at the recapture or as per the requirement, you will can you can join us in the the into classroom as
AI: Okay. So you have, like, a live feed or something where I can see her on my phone while I'm sitting out outside. That's actually really helpful because then I can see if she's okay without her getting more upset by seeing me.
User: Yeah. Yeah. We do have live CCTV access. And we provide on both the parents' number so you can see your child live and all the common area will be covered with HD quality. Right. How so and, uh, you can see your child like, you can see what your child is doing, how your child is doing. And, uh, plus, you will be getting the proper updates as well as real time update where, like, the teacher will update about the child's disposal time, arrival time, what child is eating, how much quantity, what was the activity, her participation. So there is a parent connect tab where you can see all the live CCTVs and mobile update plus you will be receiving the child observation report every month where you can see the child growth and development, how it is going, how many milestones she is covering on which weekend. Work together. Plus in the parent connect app, you can see the meal planner as well, where you can see what a child is going to have today, what is the breakfast, what is in the lunch, Snacks and the fruits. Right? And also here, we are taking like, we here, we are not only taking care of the sleeping and the, um, me, and the feeding part of the child, we're also taking care of the of the child overall development. So in footprints, we are using, uh, high school curriculum. It's child centric curriculum. Right? Because the first 5 years of the child's lives are considered the glow golden years, right, as around 90 percent of the brain developments happen during this year. So at this age, the language nuticians and the meaningful interaction player, very important role. So we use a high school curriculum. It's activity based, research based, curriculum. Maybe, like, maximize the child growth and development. And, uh, we are working on 42 key development indicators. We are working on the 6 KDs. On which, like, we are working on social and emotional development, physical development, and health. Language development, cognitive development, creative and arts, and approach to learn. So in a playgroup, the activity would be there like alphabet recognition, phonics awareness, color recognition, counting 1 to 10, all about me. Yes. So I'll suggest you can visit the branch. You will be getting more clarity. Right? You can also check our safety security protocol. Like, they're using vinyl flooring doors stopper. No no sharp edges are there. Using biometric for the parents. Right. Every Saturday, we are doing deep cleaning, herbal pest controlling. All we have, the female staff. Except guard. So the all, you can check.
AI: Sorry. Sorry. That's a lot of information. I appreciated. But I'm getting a bit overwhelmed. Let me just ask 1 thing right now. You mentioned the pickup and drop off. Like, who exactly can pick up my daughter? Because I'm a single mother, and sometimes my mother might pick her up or maybe a friend. Is that okay? And, like, how do you make sure the wrong person doesn't just take her?
User: Okay. So here, like, only the parents can pick up and drop the And if someone else is coming, you have to share all the details in writing with the photographs, with the contact details. Right? Firstly, you will approve it, then only we will hand over the child to a new to that particular person who will, like, you who are going to approve. Otherwise, you can pick up and drop the child. who are going to approve. Otherwise, you can pick up and drop the child.`
  },
];
// ─────────────────────────────────────────────────────────

async function runTests() {
  for (const tc of TEST_CASES) {
    console.log('\n' + '='.repeat(60));
    console.log('▶  ' + tc.label);
    console.log('='.repeat(60));

    const result = await scoreCall(tc.transcript, tc.persona, tc.city, tc.area);

    if (result.short_call) {
      console.log('⚠️  TOO SHORT: ' + result.word_count + ' words (min 300)\n');
      continue;
    }

    console.log('\nTOTAL: ' + result.weighted_total + '% (' + result.totalScore + '/' + result.totalApplicableWeight + ') — ' + result.grade);
    console.log('\n--- Parameters ---');
    for (const p of result.parameters) {
      if (!p.applicable) {
        console.log('  ' + p.label.padEnd(32) + 'N/A');
      } else {
        const pct = Math.round((p.score / p.weight) * 100);
        const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
        console.log('  ' + p.label.padEnd(32) + p.score + '/' + p.weight + '  ' + bar + '  ' + pct + '%');
        console.log('    Evidence: ' + p.evidence);
        console.log('    Better:   ' + p.what_good_looks_like);
        console.log();
      }
    }

    console.log('💪 Strength: ' + result.top_strength);
    console.log('🔧 Gap:      ' + result.top_gap);
    console.log('📋 Coaching: ' + result.coaching_note);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Done.');
}

runTests().catch(console.error);
