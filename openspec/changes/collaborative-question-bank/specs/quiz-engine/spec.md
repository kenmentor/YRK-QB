## ADDED Requirements

### Requirement: Practice mode quiz
The system SHALL provide untimed practice quizzes over published questions with immediate answer reveal and explanation.

#### Scenario: Practice with instant feedback
- **WHEN** a learner starts a practice quiz filtered by exam/topic and answers a question
- **THEN** the system immediately shows correctness and the explanation without ending the quiz

#### Scenario: Practice uses only published questions
- **WHEN** a practice quiz is generated
- **THEN** it includes only published canonical questions matching the filter, never drafts or aliases

### Requirement: Timed exam mode with scoring
The system SHALL provide timed mock exams that snapshot questions at start, auto-submit on timeout, grade on submit, and store the attempt.

#### Scenario: Timed mock flow
- **WHEN** a learner starts an exam-mode quiz with N questions and T minutes
- **THEN** the system snapshots the question set, enforces the countdown, auto-submits at zero, and shows total score plus per-question correctness

#### Scenario: Timeout auto-submit
- **WHEN** the timer expires before manual submit
- **THEN** the system auto-submits answered questions, marks unanswered as incorrect, and stores the attempt

### Requirement: Attempt history and weak areas
The system SHALL store per-user quiz attempts with per-question results and aggregate correctness by topic for basic weak-area reporting.

#### Scenario: View history
- **WHEN** a learner views their history
- **THEN** they see past attempts with date, mode, filter, score, and per-question breakdown

#### Scenario: Weak-area summary
- **WHEN** a learner views their performance summary
- **THEN** the system shows accuracy grouped by topic from completed attempts
