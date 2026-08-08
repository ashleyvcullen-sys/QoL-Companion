import { AlertTriangle, BookOpen, HeartHandshake, Heart, PawPrint } from 'lucide-react'
import AboutIcon from '../components/icons/AboutIcon'
import BrokenHeartIcon from '../components/icons/BrokenHeartIcon'

export const END_OF_LIFE_TOPICS = [
  {
    key: 'know-when',
    label: "How to know when it's time",
    Icon: AboutIcon,
    paragraphs: [
      "There's no single test that decides this — it's a combination of your vet's assessment and what you observe day to day, which is exactly what the Quality of Life scores in this app are for. A useful rule of thumb many vets use: if there are consistently **more bad days than good** over a couple of weeks, or the good days are only 'okay' while the bad days are truly hard, that's usually a sign quality of life has slipped below what's fair to ask your pet to keep living with.",
      {
        type: 'list',
        intro: 'Other signals worth weighing alongside the QoL score:',
        items: [
          "Pain that isn't responding to treatment",
          "An illness that's no longer being helped by medication",
          'Persistent loss of interest in things they used to enjoy',
          "A body that is visibly failing, even if their personality is still there.",
        ],
      },
      'None of this has to be decided alone — consult with your veterinarian to help guide the decision-making process.',
      "It's also normal to feel like you're deciding 'too early' or 'too late' no matter when you choose — that discomfort doesn't mean the decision is wrong.",
      "It is very common for pet owners to feel guilty and to see euthanasia as 'giving up.' They will therefore often wait until the last minute to make this difficult decision. Unfortunately, in hindsight, many owners regret waiting too long due to the poor quality of life their pet experienced at the end. Waiting too long can also limit control and available options when the time comes to say goodbye — emergency situations and traumatic passings become far more likely. It is far more peaceful to make the decision earlier rather than too late.",
      "This is one of the hardest decisions a pet owner can face — but it's also one of the most selfless and kindest things you can do for them. Choosing to spare your pet from suffering, even when it breaks your heart, is a final act of love.",
    ],
  },
  {
    key: 'natural-death',
    label: "Why a 'natural' death often isn't peaceful",
    Icon: AlertTriangle,
    paragraphs: [
      "It's a common hope that a pet will simply pass away quietly in their sleep at home, and it can happen — but for most terminal or end-stage conditions, it's the exception rather than the rule. As organs fail or disease progresses, the more common pattern is a period of labored breathing, pain, disorientation, seizures, or the body struggling in ways that are distressing to witness and, more importantly, to experience.",
      "Euthanasia exists precisely to prevent that final stretch of suffering. It's fast and controlled: often a sedative first, so your pet is deeply relaxed or asleep, followed by an overdose of anaesthetic that stops the heart within moments, entirely painlessly. Choosing euthanasia isn't giving up early — for many pets, it's the kinder ending compared to what letting the disease run its course would actually look like.",
      'Choosing euthanasia is a selfless final act of love.',
    ],
  },
  {
    key: 'euthanasia-process',
    label: 'The euthanasia process & options',
    Icon: BookOpen,
    paragraphs: [
      "Most vets use a two-step process: a sedative or pain-relief injection first, which lets your pet relax fully (often they'll appear to fall asleep), followed by the euthanasia solution itself, usually given into a vein. The process is extremely peaceful and not painful.",
      "You can usually choose between an in-clinic appointment or an at-home visit from a mobile/in-home euthanasia vet, where these services are available in your area. In-clinic tends to be more readily available and has full medical support on hand; at-home means your pet can be in a familiar space, without a car trip — many families find saying goodbye at home to be more meaningful and less stressful. Ask your regular vet what they offer or who they'd recommend locally.",
      "You can typically choose whether to be present, and whether other family members or pets are there too. There's no right answer — some people want to be there until the end, others find it too hard and prefer to say goodbye beforehand.",
    ],
  },
  {
    key: 'aftercare',
    label: 'Aftercare options & providers',
    Icon: HeartHandshake,
    paragraphs: [
      "Common options are home burial (where local regulations allow it — worth checking first), private cremation (your pet is cremated individually and the ashes returned to you), and communal cremation (ashes are not returned, generally the more affordable option). Many clinics also offer memorial keepsakes — a clay paw print, a lock of fur, a certificate.",
      "Your vet clinic can usually arrange cremation directly through a local pet crematorium, or point you to a dedicated aftercare provider — it's completely fine to ask about pricing and options in advance, before you need them, so it's one less decision to make in the moment.",
    ],
  },
  {
    key: 'anticipatory-grief',
    label: 'Anticipatory grief',
    Icon: BrokenHeartIcon,
    paragraphs: [
      "Grieving often starts well before the loss itself — while you're still caring for a pet who is declining, it's very common to feel waves of sadness, guilt, dread, or even relief-tinged-with-guilt, all at once. This is called anticipatory grief, and it's a normal, well-recognised response, not a sign you're 'giving up' on your pet.",
      "It can help to let yourself feel it rather than push it away, to talk to someone who understands what this pet means to you, and to make space for good moments with your pet alongside the hard ones — both are real and both matter.",
    ],
  },
  {
    key: 'children-grief',
    label: 'How children grieve, and how to talk to them about euthanasia',
    Icon: Heart,
    paragraphs: [
      "Children process pet loss very differently depending on age — the table below is a general guide, not a strict rule, since every child is different.",
      "Gentle honesty tends to work better than euphemisms. Phrases like 'put to sleep' can accidentally create a fear of sleep or of going to the vet for anything. Something closer to: 'the vet is going to give [pet] medicine that will stop their body from working, so they won't hurt anymore, and then they will die — we won't be able to see them again, but we'll always remember them' tends to be clearer and, in the long run, less frightening.",
      "Where it feels right, let children choose whether to be involved — saying goodbye beforehand, being present, or creating a small memorial afterward (a drawing, a paw print, a favourite photo) can all help them process it concretely. There's no need to hide your own grief from them; seeing that it's okay for adults to be sad too is part of how children learn grief is survivable.",
    ],
    hasAgeBracketPicker: true,
    citation: 'Adapted from material by Kristi Lehman, MSW, LISW, DVM Center.',
  },
  {
    key: 'other-pets-grief',
    label: 'How other pets grieve',
    Icon: PawPrint,
    paragraphs: [
      "Surviving pets grieve just like we do. They often show real changes after a companion dies — searching the house, changes in appetite or sleep, increased clinginess, or withdrawal. These behaviour changes reflect a genuine sense of loss, not just a disrupted routine.",
      "It is often helpful to let a surviving pet see or sniff their companion after they have passed. This helps them to understand that their companion is no longer with us. Many seem to settle faster with a clear 'ending' rather than a companion simply vanishing. Otherwise, keeping routines steady, offering extra affection, and giving it a few weeks before worrying about persistent changes is generally reasonable — though ongoing loss of appetite or withdrawal is still worth a vet check, since grief and illness can look similar.",
    ],
  },
]

export const AGE_BRACKET_GRIEF_DATA = [
  {
    key: '0-3',
    label: '0–3',
    grieve: 'Little outward grief; may sense household stress and become clingy or unsettled without knowing why.',
    understanding: "No real concept of permanence — can't grasp that it's forever.",
    help: 'Keep routines steady, offer extra physical comfort, use simple and consistent words.',
  },
  {
    key: '4-5',
    label: '4–5',
    grieve: 'Brief sadness or confusion, often mixed with normal play soon after.',
    understanding: 'Sees death as reversible or temporary — like sleep or a trip away.',
    help: "Use simple, honest, concrete language (avoid 'sleep' or 'went away'), answer repeated questions patiently, reassure it's not their fault.",
  },
  {
    key: '6-8',
    label: '6–8',
    grieve: 'Starting to feel real sadness, anger, or worry about other loved ones dying; may ask blunt questions.',
    understanding: 'Beginning to understand death is final, though may still bargain or personify it.',
    help: 'Answer questions honestly and directly, validate their feelings, involve them in small rituals like a drawing or goodbye.',
  },
  {
    key: '9-12',
    label: '9–12',
    grieve: "Grief closer to a smaller version of adult grief; may withdraw, or act 'fine' to cope.",
    understanding: 'Understands death is permanent and universal; may want factual detail.',
    help: "Give honest, age-appropriate detail if asked, encourage them to express feelings their own way, don't rush them toward 'closure.'",
  },
  {
    key: '13-18',
    label: '13–18',
    grieve: 'Grief patterns closer to adults, often expressed more privately or with peers than with family.',
    understanding: 'Full adult-level understanding, sometimes alongside bigger existential questions.',
    help: 'Respect their need for privacy while staying available, treat them as capable of an honest conversation, check in without pushing.',
  },
]
