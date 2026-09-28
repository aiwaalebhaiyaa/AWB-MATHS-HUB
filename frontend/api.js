window.API = {

  async request(path, options = {}) {

    const r = await fetch(path, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    const d = await r.json().catch(() => ({}));

    if (!r.ok) {
      throw new Error(
        d.error || "Request failed."
      );
    }

    return d;
  },


  // =========================
  // AUTH
  // =========================

  signup: (
    name,
    sbuId,
    email,
    password
  ) =>
    API.request(
      "/api/auth/signup",
      {
        method: "POST",

        body: JSON.stringify({
          name,
          sbuId,
          email,
          password
        })
      }
    ),


  // Login with SBU ID OR Email
  login: (
    identifier,
    password
  ) =>
    API.request(
      "/api/auth/login",
      {
        method: "POST",

        body: JSON.stringify({
          identifier,
          password
        })
      }
    ),


  me: () =>
    API.request(
      "/api/auth/me"
    ),


  logout: () =>
    API.request(
      "/api/auth/logout",
      {
        method: "POST"
      }
    ),


  // =========================
  // STUDENT DASHBOARD
  // =========================

  dashboard: () =>
    API.request(
      "/api/dashboard"
    ),


  streak: () =>
    API.request(
      "/api/progress/streak",
      {
        method: "POST"
      }
    ),


  topic: (
    moduleId,
    topicIndex
  ) =>
    API.request(
      "/api/progress/topic",
      {
        method: "POST",

        body: JSON.stringify({
          moduleId,
          topicIndex
        })
      }
    ),


  // =========================
  // MISTAKE BOOK
  // =========================

  mistake: (p) =>
    API.request(
      "/api/mistakes",
      {
        method: "POST",

        body: JSON.stringify(p)
      }
    ),


  deleteMistake: (id) =>
    API.request(
      "/api/mistakes/" + id,
      {
        method: "DELETE"
      }
    ),


  // =========================
  // QUIZ / PRACTICE / EXAM
  // =========================

  attempt: (
    mode,
    moduleId,
    score,
    total,
    durationSeconds
  ) =>
    API.request(
      "/api/attempts",
      {
        method: "POST",

        body: JSON.stringify({
          mode,
          moduleId,
          score,
          total,
          durationSeconds
        })
      }
    ),


  // =========================
  // AI TEACHER
  // =========================

  aiTeach: (p) =>
    API.request(
      "/api/ai/teach",
      {
        method: "POST",

        body: JSON.stringify(p)
      }
    ),


  // =========================
  // ADMIN
  // =========================

  adminOverview: () =>
    API.request(
      "/api/admin/overview"
    ),


  adminQuestions: () =>
    API.request(
      "/api/admin/questions"
    ),


  addQuestion: (p) =>
    API.request(
      "/api/admin/questions",
      {
        method: "POST",

        body: JSON.stringify(p)
      }
    ),


  deleteQuestion: (id) =>
    API.request(
      "/api/admin/questions/" + id,
      {
        method: "DELETE"
      }
    ),


  adminFormulas: () =>
    API.request(
      "/api/admin/formulas"
    ),


  addFormula: (p) =>
    API.request(
      "/api/admin/formulas",
      {
        method: "POST",

        body: JSON.stringify(p)
      }
    ),


  deleteFormula: (id) =>
    API.request(
      "/api/admin/formulas/" + id,
      {
        method: "DELETE"
      }
    )

};