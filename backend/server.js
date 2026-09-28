require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const rateLimit = require("express-rate-limit");


/* =========================================================
   ENVIRONMENT CHECK
========================================================= */

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in .env");
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long");
}


/* =========================================================
   APP
========================================================= */

const app = express();

const PORT = Number(process.env.PORT || 3000);

const isProd =
  process.env.NODE_ENV === "production";

const frontendPath =
  path.join(__dirname, "..", "frontend");


/* =========================================================
   DATABASE
========================================================= */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProd
    ? { rejectUnauthorized: false }
    : false
});


/* =========================================================
   DATABASE COMPATIBILITY
   Ensures SBU ID column exists.
========================================================= */

async function ensureDatabaseCompatibility() {
  try {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS sbu_id VARCHAR(30)
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_sbu_id
      ON users(sbu_id)
      WHERE sbu_id IS NOT NULL
    `);

    console.log("Database compatibility check passed.");
  } catch (e) {
    console.error("DATABASE COMPATIBILITY ERROR:", e);
    throw e;
  }
}


/* =========================================================
   SECURITY
========================================================= */

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        scriptSrc: [
          "'self'",
          "'unsafe-inline'"
        ],

        scriptSrcAttr: [
          "'unsafe-inline'"
        ],

        styleSrc: [
          "'self'",
          "'unsafe-inline'"
        ],

        imgSrc: [
          "'self'",
          "data:",
          "https:"
        ],

        connectSrc: [
          "'self'"
        ],

        fontSrc: [
          "'self'",
          "data:",
          "https:"
        ],

        objectSrc: [
          "'none'"
        ],

        baseUri: [
          "'self'"
        ],

        frameAncestors: [
          "'self'"
        ]
      }
    },

    crossOriginResourcePolicy: {
      policy: "same-site"
    }
  })
);


app.use(
  express.json({
    limit: "120kb"
  })
);

app.use(cookieParser());


/* =========================================================
   RATE LIMITERS
========================================================= */

const apiLimiter =
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false
  });

const authLimiter =
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false
  });

const aiLimiter =
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: "draft-8",
    legacyHeaders: false
  });


app.use(
  "/api",
  apiLimiter
);

app.use(
  "/api/auth",
  authLimiter
);

app.use(
  "/api/ai",
  aiLimiter
);


/* =========================================================
   JWT
========================================================= */

function tokenFor(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role
    },

    process.env.JWT_SECRET,

    {
      expiresIn: "7d",
      issuer: "awb-maths-hub"
    }
  );
}


/* =========================================================
   COOKIES
========================================================= */

function setCookie(res, token) {
  res.cookie(
    "awb_token",
    token,
    {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/"
    }
  );
}


function clearCookie(res) {
  res.clearCookie(
    "awb_token",
    {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/"
    }
  );
}


/* =========================================================
   VALIDATORS
========================================================= */

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


/*
   SBU ID format:

   SBU2601477

   SBU + exactly 7 digits
*/

function validSbuId(sbuId) {
  return /^SBU\d{7}$/.test(sbuId);
}


/* =========================================================
   SAFE USER
========================================================= */

function safeUser(u) {
  return {
    id: u.id,
    name: u.name,
    sbu_id: u.sbu_id,
    email: u.email,
    role: u.role,
    xp: u.xp,
    streak: u.streak,
    last_active_date: u.last_active_date,
    created_at: u.created_at
  };
}


/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

async function auth(req, res, next) {
  try {
    const token =
      req.cookies.awb_token;

    if (!token) {
      return res
        .status(401)
        .json({
          error:
            "Authentication required."
        });
    }

    const p =
      jwt.verify(
        token,
        process.env.JWT_SECRET,
        {
          issuer:
            "awb-maths-hub"
        }
      );

    const { rows } =
      await pool.query(
        `
        SELECT
          id,
          name,
          sbu_id,
          email,
          role,
          xp,
          streak,
          last_active_date,
          created_at
        FROM users
        WHERE id=$1
        `,
        [p.sub]
      );

    if (!rows[0]) {
      clearCookie(res);

      return res
        .status(401)
        .json({
          error:
            "Account not found."
        });
    }

    req.user =
      rows[0];

    next();

  } catch {
    clearCookie(res);

    return res
      .status(401)
      .json({
        error:
          "Invalid or expired session."
      });
  }
}


/* =========================================================
   ADMIN MIDDLEWARE
========================================================= */

function admin(req, res, next) {
  if (
    req.user?.role !==
    "admin"
  ) {
    return res
      .status(403)
      .json({
        error:
          "Admin access required."
      });
  }

  next();
}


/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/api/health",
  async (req, res) => {
    try {
      await pool.query(
        "SELECT 1"
      );

      res.json({
        ok: true,
        service:
          "AWB MATHS HUB API",
        aiConfigured:
          Boolean(
            process.env.AI_API_KEY
          )
      });

    } catch {
      res
        .status(503)
        .json({
          ok: false,
          error:
            "Database unavailable"
        });
    }
  }
);


/* =========================================================
   SIGNUP
========================================================= */

app.post(
  "/api/auth/signup",
  async (req, res) => {
    try {
      const name =
        String(
          req.body.name || ""
        ).trim();

      const sbuId =
        String(
          req.body.sbuId || ""
        )
          .trim()
          .toUpperCase();

      const email =
        String(
          req.body.email || ""
        )
          .trim()
          .toLowerCase();

      const password =
        String(
          req.body.password || ""
        );


      /* NAME */

      if (
        name.length < 2 ||
        name.length > 80
      ) {
        return res
          .status(400)
          .json({
            error:
              "Name must be 2-80 characters."
          });
      }


      /* SBU ID */

      if (
        !validSbuId(sbuId)
      ) {
        return res
          .status(400)
          .json({
            error:
              "Enter a valid SBU ID. Example: SBU2601477"
          });
      }


      /* EMAIL */

      if (
        !validEmail(email) ||
        email.length > 255
      ) {
        return res
          .status(400)
          .json({
            error:
              "Enter a valid email."
          });
      }


      /* PASSWORD */

      if (
        password.length < 8 ||
        password.length > 128
      ) {
        return res
          .status(400)
          .json({
            error:
              "Password must be 8-128 characters."
          });
      }


      /* CHECK EMAIL + SBU ID */

      const exists =
        await pool.query(
          `
          SELECT
            id,
            email,
            sbu_id
          FROM users
          WHERE LOWER(email)=LOWER($1)
             OR UPPER(sbu_id)=UPPER($2)
          LIMIT 1
          `,
          [
            email,
            sbuId
          ]
        );


      if (
        exists.rows[0]
      ) {
        const existing =
          exists.rows[0];

        if (
          existing.email &&
          existing.email.toLowerCase() ===
          email.toLowerCase()
        ) {
          return res
            .status(409)
            .json({
              error:
                "Email already registered. Please login."
            });
        }

        if (
          existing.sbu_id &&
          existing.sbu_id.toUpperCase() ===
          sbuId.toUpperCase()
        ) {
          return res
            .status(409)
            .json({
              error:
                "This SBU ID is already registered."
            });
        }

        return res
          .status(409)
          .json({
            error:
              "Account already exists."
          });
      }


      /* PASSWORD HASH */

      const hash =
        await bcrypt.hash(
          password,
          12
        );


      /* CREATE STUDENT */

      const {
        rows
      } = await pool.query(
        `
        INSERT INTO users
        (
          name,
          sbu_id,
          email,
          password_hash
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4
        )
        RETURNING
          id,
          name,
          sbu_id,
          email,
          role,
          xp,
          streak,
          last_active_date,
          created_at
        `,
        [
          name,
          sbuId,
          email,
          hash
        ]
      );


      setCookie(
        res,
        tokenFor(
          rows[0]
        )
      );


      res
        .status(201)
        .json({
          user:
            rows[0]
        });

    } catch (e) {
      console.error(
        "SIGNUP ERROR:",
        e
      );

      if (
        e.code ===
        "23505"
      ) {
        return res
          .status(409)
          .json({
            error:
              "Email or SBU ID already registered."
          });
      }

      res
        .status(500)
        .json({
          error:
            "Could not create account."
        });
    }
  }
);


/* =========================================================
   LOGIN

   Student can login using:
   1. Email
   2. SBU ID

   Both use the same password.
========================================================= */

app.post(
  "/api/auth/login",
  async (req, res) => {
    try {
      const identifier =
        String(
          req.body.identifier ??
          req.body.email ??
          req.body.sbuId ??
          ""
        ).trim();

      const password =
        String(
          req.body.password || ""
        );


      if (
        !identifier ||
        !password
      ) {
        return res
          .status(400)
          .json({
            error:
              "SBU ID/email and password are required."
          });
      }


      const { rows } =
        await pool.query(
          `
          SELECT *
          FROM users
          WHERE LOWER(email)=LOWER($1)
             OR UPPER(sbu_id)=UPPER($1)
          LIMIT 1
          `,
          [identifier]
        );


      const user =
        rows[0];


      if (
        !user ||
        !(await bcrypt.compare(
          password,
          user.password_hash
        ))
      ) {
        return res
          .status(401)
          .json({
            error:
              "Invalid SBU ID/email or password."
          });
      }


      setCookie(
        res,
        tokenFor(user)
      );


      res.json({
        user:
          safeUser(user)
      });

    } catch (e) {
      console.error(
        "LOGIN ERROR:",
        e
      );

      res
        .status(500)
        .json({
          error:
            "Login failed."
        });
    }
  }
);


/* =========================================================
   CURRENT USER
========================================================= */

app.get(
  "/api/auth/me",
  auth,
  (req, res) => {
    res.json({
      user:
        req.user
    });
  }
);


/* =========================================================
   LOGOUT
========================================================= */

app.post(
  "/api/auth/logout",
  (req, res) => {
    clearCookie(res);

    res.json({
      ok: true
    });
  }
);


/* =========================================================
   DASHBOARD
========================================================= */

app.get(
  "/api/dashboard",
  auth,
  async (req, res) => {
    try {
      const [
        topics,
        mistakes,
        attempts
      ] =
        await Promise.all([

          pool.query(
            `
            SELECT
              module_id,
              topic_index,
              completed_at
            FROM topic_progress
            WHERE user_id=$1
            ORDER BY
              module_id,
              topic_index
            `,
            [
              req.user.id
            ]
          ),

          pool.query(
            `
            SELECT
              id,
              source,
              module_id,
              question,
              selected_answer,
              correct_answer,
              explanation,
              created_at
            FROM mistakes
            WHERE user_id=$1
            ORDER BY
              created_at DESC
            `,
            [
              req.user.id
            ]
          ),

          pool.query(
            `
            SELECT
              id,
              mode,
              module_id,
              score,
              total,
              duration_seconds,
              created_at
            FROM attempts
            WHERE user_id=$1
            ORDER BY
              created_at DESC
            LIMIT 100
            `,
            [
              req.user.id
            ]
          )

        ]);


      res.json({
        user:
          req.user,

        topics:
          topics.rows,

        mistakes:
          mistakes.rows,

        attempts:
          attempts.rows
      });

    } catch (e) {
      console.error(
        "DASHBOARD ERROR:",
        e
      );

      res
        .status(500)
        .json({
          error:
            "Could not load dashboard."
        });
    }
  }
);


/* =========================================================
   TOPIC PROGRESS
========================================================= */

app.post(
  "/api/progress/topic",
  auth,
  async (req, res) => {

    const moduleId =
      String(
        req.body.moduleId || ""
      ).trim();

    const topicIndex =
      Number(
        req.body.topicIndex
      );


    if (
      !/^M[1-5]$/.test(
        moduleId
      ) ||
      !Number.isInteger(
        topicIndex
      ) ||
      topicIndex < 0 ||
      topicIndex > 50
    ) {
      return res
        .status(400)
        .json({
          error:
            "Invalid topic."
        });
    }


    const c =
      await pool.connect();

    try {

      await c.query(
        "BEGIN"
      );


      const ins =
        await c.query(
          `
          INSERT INTO topic_progress
          (
            user_id,
            module_id,
            topic_index
          )
          VALUES
          (
            $1,
            $2,
            $3
          )
          ON CONFLICT
          (
            user_id,
            module_id,
            topic_index
          )
          DO NOTHING
          RETURNING id
          `,
          [
            req.user.id,
            moduleId,
            topicIndex
          ]
        );


      if (
        ins.rowCount
      ) {
        await c.query(
          `
          UPDATE users
          SET
            xp=xp+20,
            updated_at=NOW()
          WHERE id=$1
          `,
          [
            req.user.id
          ]
        );
      }


      await c.query(
        "COMMIT"
      );


      const {
        rows
      } = await pool.query(
        `
        SELECT
          id,
          name,
          sbu_id,
          email,
          role,
          xp,
          streak,
          last_active_date,
          created_at
        FROM users
        WHERE id=$1
        `,
        [
          req.user.id
        ]
      );


      res.json({
        ok: true,
        user:
          rows[0]
      });

    } catch (e) {

      await c.query(
        "ROLLBACK"
      );

      console.error(e);

      res
        .status(500)
        .json({
          error:
            "Could not save topic progress."
        });

    } finally {

      c.release();

    }
  }
);


/* =========================================================
   STREAK
========================================================= */

app.post(
  "/api/progress/streak",
  auth,
  async (req, res) => {

    const today =
      new Date()
        .toISOString()
        .slice(0, 10);


    const {
      rows
    } = await pool.query(
      `
      SELECT
        last_active_date,
        streak
      FROM users
      WHERE id=$1
      `,
      [
        req.user.id
      ]
    );


    const last =
      rows[0]?.last_active_date;

    let streak =
      Number(
        rows[0]?.streak || 0
      );


    if (
      last !== today
    ) {

      const d =
        last
          ? new Date(
              last +
              "T00:00:00"
            )
          : null;


      const t =
        new Date(
          today +
          "T00:00:00"
        );


      const diff =
        d
          ? Math.round(
              (t - d) /
              86400000
            )
          : 0;


      streak =
        diff === 1
          ? streak + 1
          : 1;


      await pool.query(
        `
        UPDATE users
        SET
          streak=$1,
          last_active_date=$2,
          updated_at=NOW()
        WHERE id=$3
        `,
        [
          streak,
          today,
          req.user.id
        ]
      );
    }


    const u =
      await pool.query(
        `
        SELECT
          id,
          name,
          sbu_id,
          email,
          role,
          xp,
          streak,
          last_active_date,
          created_at
        FROM users
        WHERE id=$1
        `,
        [
          req.user.id
        ]
      );


    res.json({
      user:
        u.rows[0]
    });
  }
);


/* =========================================================
   MISTAKES
========================================================= */

app.post(
  "/api/mistakes",
  auth,
  async (req, res) => {

    try {

      const {
        source = "PRACTICE",
        moduleId,
        question,
        selectedAnswer = "",
        correctAnswer,
        explanation = ""
      } = req.body;


      if (
        !question ||
        !correctAnswer
      ) {
        return res
          .status(400)
          .json({
            error:
              "Question and correct answer are required."
          });
      }


      const {
        rows
      } = await pool.query(
        `
        INSERT INTO mistakes
        (
          user_id,
          source,
          module_id,
          question,
          selected_answer,
          correct_answer,
          explanation
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        )
        RETURNING *
        `,
        [
          req.user.id,

          String(
            source
          ).slice(0, 30),

          moduleId ||
            null,

          String(
            question
          ),

          String(
            selectedAnswer
          ),

          String(
            correctAnswer
          ),

          String(
            explanation
          )
        ]
      );


      res
        .status(201)
        .json({
          mistake:
            rows[0]
        });

    } catch (e) {

      console.error(e);

      res
        .status(500)
        .json({
          error:
            "Could not save mistake."
        });
    }
  }
);


/* =========================================================
   DELETE MISTAKE
========================================================= */

app.delete(
  "/api/mistakes/:id",
  auth,
  async (req, res) => {

    await pool.query(
      `
      DELETE FROM mistakes
      WHERE
        id=$1
        AND user_id=$2
      `,
      [
        req.params.id,
        req.user.id
      ]
    );


    res.json({
      ok: true
    });
  }
);


/* =========================================================
   ATTEMPTS
========================================================= */

app.post(
  "/api/attempts",
  auth,
  async (req, res) => {

    try {

      const mode =
        String(
          req.body.mode ||
          "QUIZ"
        ).slice(0, 20);


      const moduleId =
        req.body.moduleId
          ? String(
              req.body.moduleId
            )
          : null;


      const score =
        Number(
          req.body.score
        );


      const total =
        Number(
          req.body.total
        );


      const duration =
        Number(
          req.body.durationSeconds ||
          0
        );


      if (
        !Number.isInteger(score) ||
        !Number.isInteger(total) ||
        total <= 0 ||
        score < 0 ||
        score > total
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid result."
          });
      }


      const xp =
        score *
        (
          mode === "EXAM"
            ? 15
            : 5
        );


      await pool.query(
        `
        INSERT INTO attempts
        (
          user_id,
          mode,
          module_id,
          score,
          total,
          duration_seconds
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6
        )
        `,
        [
          req.user.id,
          mode,
          moduleId,
          score,
          total,
          duration
        ]
      );


      await pool.query(
        `
        UPDATE users
        SET
          xp=xp+$1,
          updated_at=NOW()
        WHERE id=$2
        `,
        [
          xp,
          req.user.id
        ]
      );


      const {
        rows
      } = await pool.query(
        `
        SELECT
          id,
          name,
          sbu_id,
          email,
          role,
          xp,
          streak,
          last_active_date,
          created_at
        FROM users
        WHERE id=$1
        `,
        [
          req.user.id
        ]
      );


      res
        .status(201)
        .json({
          user:
            rows[0],

          xpAwarded:
            xp
        });

    } catch (e) {

      console.error(e);

      res
        .status(500)
        .json({
          error:
            "Could not save attempt."
        });
    }
  }
);


/* =========================================================
   AI TEACHER AYAN
========================================================= */

app.post(
  "/api/ai/teach",
  async (req, res) => {

    try {

      const question =
        String(
          req.body.question ||
          ""
        )
          .trim()
          .slice(0, 4000);


      const moduleId =
        String(
          req.body.moduleId ||
          ""
        )
          .trim();


      const topic =
        String(
          req.body.topic ||
          ""
        )
          .trim()
          .slice(0, 300);


      const mode =
        String(
          req.body.mode ||
          "explain"
        )
          .trim()
          .slice(0, 40);


      if (!question) {
        return res
          .status(400)
          .json({
            error:
              "Ask AYAN a maths question first."
          });
      }


      const system =
`You are AYAN, the male Hinglish AI teacher inside AWB MATHS HUB.

Teach BCA Mathematics-I at college + exam level.

Syllabus scope:
M1 differentiation;
M2 partial differentiation/Jacobians;
M3 integration/double integration/area;
M4 differential equations;
M5 matrices/eigenvalues/Cayley-Hamilton.

Teaching loop:
identify concept -> simple Hinglish explanation -> formula -> worked steps -> common mistake -> one mini practice question.

Never invent a class-note claim.

If the question is outside this syllabus, say so and redirect.

Do not simply give a final answer when a step-by-step solution is useful.

Keep notation clear.

Current module: ${moduleId};
current topic: ${topic};
mode: ${mode}.`;


      if (
        !process.env.AI_API_KEY ||
        !process.env.AI_API_URL
      ) {

        return res.json({

          source:
            "fallback",

          answer:
`AYAN: Is question ko step-by-step karte hain.

Question: ${question}

1) Pehle identify karo ki ye ${topic || "kaunsa concept"} ka problem hai.
2) Relevant formula/rule likho.
3) Values ko substitute karke line-by-line simplify karo.
4) Final answer ke saath ek baar sign, power aur arithmetic check karo.

Agar tum exact question/photo ka text bhejoge, main isi format me complete solution dunga.`
        });
      }


      const payload = {

        model:
          process.env.AI_MODEL ||
          "gpt-4o-mini",

        messages: [

          {
            role:
              "system",

            content:
              system
          },

          {
            role:
              "user",

            content:
              question
          }

        ],

        temperature:
          0.2,

        max_tokens:
          900
      };


      const r =
        await fetch(
          process.env.AI_API_URL,
          {
            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${process.env.AI_API_KEY}`
            },

            body:
              JSON.stringify(
                payload
              )
          }
        );


      const data =
        await r
          .json()
          .catch(
            () => ({})
          );


      if (!r.ok) {

        return res
          .status(502)
          .json({

            error:
              "AI teacher provider returned an error.",

            detail:
              data.error?.message ||
              data.error ||
              undefined
          });
      }


      const answer =
        data
          .choices?.[0]
          ?.message
          ?.content ||

        data.output_text ||

        data.answer;


      if (!answer) {

        return res
          .status(502)
          .json({
            error:
              "AI provider returned no teaching response."
          });
      }


      res.json({
        source:
          "ai",

        answer
      });


    } catch (e) {

      console.error(e);

      res
        .status(502)
        .json({
          error:
            "AYAN AI is temporarily unavailable."
        });
    }
  }
);


/* =========================================================
   ADMIN OVERVIEW
========================================================= */

app.get(
  "/api/admin/overview",
  auth,
  admin,
  async (req, res) => {

    try {

      const [
        students,
        attempts,
        mistakes,
        topics,
        questions,
        formulas
      ] =
        await Promise.all([

          pool.query(
            `
            SELECT
              COUNT(*)::int count
            FROM users
            WHERE role='student'
            `
          ),

          pool.query(
            `
            SELECT
              COUNT(*)::int count
            FROM attempts
            `
          ),

          pool.query(
            `
            SELECT
              COUNT(*)::int count
            FROM mistakes
            `
          ),

          pool.query(
            `
            SELECT
              COUNT(*)::int count
            FROM topic_progress
            `
          ),

          pool.query(
            `
            SELECT
              COUNT(*)::int count
            FROM questions
            WHERE is_active=true
            `
          ),

          pool.query(
            `
            SELECT
              COUNT(*)::int count
            FROM formulas
            WHERE is_active=true
            `
          )

        ]);


      const recent =
        await pool.query(
          `
          SELECT
            id,
            name,
            sbu_id,
            email,
            xp,
            streak,
            created_at
          FROM users
          WHERE role='student'
          ORDER BY
            created_at DESC
          LIMIT 100
          `
        );


      res.json({

        counts: {

          students:
            students.rows[0].count,

          attempts:
            attempts.rows[0].count,

          mistakes:
            mistakes.rows[0].count,

          completedTopics:
            topics.rows[0].count,

          questions:
            questions.rows[0].count,

          formulas:
            formulas.rows[0].count
        },

        students:
          recent.rows
      });


    } catch (e) {

      console.error(e);

      res
        .status(500)
        .json({
          error:
            "Could not load admin overview."
        });
    }
  }
);


/* =========================================================
   ADMIN QUESTIONS
========================================================= */

app.get(
  "/api/admin/questions",
  auth,
  admin,
  async (req, res) => {

    const {
      rows
    } = await pool.query(
      `
      SELECT *
      FROM questions
      ORDER BY id DESC
      LIMIT 500
      `
    );


    res.json({
      questions:
        rows
    });
  }
);


/* =========================================================
   ADMIN ADD QUESTION
========================================================= */

app.post(
  "/api/admin/questions",
  auth,
  admin,
  async (req, res) => {

    const {
      moduleId,
      topicIndex,
      mode = "PRACTICE",
      question,
      options = [],
      correctAnswer,
      explanation = "",
      sourceLabel = "Admin-created"
    } = req.body;


    if (
      !/^M[1-5]$/.test(
        String(
          moduleId ||
          ""
        )
      ) ||
      !question ||
      !correctAnswer ||
      !Array.isArray(
        options
      ) ||
      options.length < 2
    ) {

      return res
        .status(400)
        .json({
          error:
            "Module, question, 2+ options and answer are required."
        });
    }


    const {
      rows
    } = await pool.query(
      `
      INSERT INTO questions
      (
        module_id,
        topic_index,
        mode,
        question,
        options,
        correct_answer,
        explanation,
        source_label
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8
      )
      RETURNING *
      `,
      [
        moduleId,
        topicIndex ?? null,
        mode,
        question,
        JSON.stringify(
          options
        ),
        correctAnswer,
        explanation,
        sourceLabel
      ]
    );


    res
      .status(201)
      .json({
        question:
          rows[0]
      });
  }
);


/* =========================================================
   ADMIN DELETE QUESTION
========================================================= */

app.delete(
  "/api/admin/questions/:id",
  auth,
  admin,
  async (req, res) => {

    await pool.query(
      `
      UPDATE questions
      SET
        is_active=false,
        updated_at=NOW()
      WHERE id=$1
      `,
      [
        req.params.id
      ]
    );


    res.json({
      ok: true
    });
  }
);


/* =========================================================
   ADMIN FORMULAS
========================================================= */

app.get(
  "/api/admin/formulas",
  auth,
  admin,
  async (req, res) => {

    const {
      rows
    } = await pool.query(
      `
      SELECT *
      FROM formulas
      ORDER BY id DESC
      LIMIT 500
      `
    );


    res.json({
      formulas:
        rows
    });
  }
);


/* =========================================================
   ADMIN ADD FORMULA
========================================================= */

app.post(
  "/api/admin/formulas",
  auth,
  admin,
  async (req, res) => {

    const {
      moduleId,
      topicIndex,
      title,
      formula,
      explanation = "",
      sourceLabel = "Admin-created"
    } = req.body;


    if (
      !/^M[1-5]$/.test(
        String(
          moduleId ||
          ""
        )
      ) ||
      !title ||
      !formula
    ) {

      return res
        .status(400)
        .json({
          error:
            "Module, title and formula required."
        });
    }


    const {
      rows
    } = await pool.query(
      `
      INSERT INTO formulas
      (
        module_id,
        topic_index,
        title,
        formula,
        explanation,
        source_label
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6
      )
      RETURNING *
      `,
      [
        moduleId,
        topicIndex ?? null,
        title,
        formula,
        explanation,
        sourceLabel
      ]
    );


    res
      .status(201)
      .json({
        formula:
          rows[0]
      });
  }
);


/* =========================================================
   ADMIN DELETE FORMULA
========================================================= */

app.delete(
  "/api/admin/formulas/:id",
  auth,
  admin,
  async (req, res) => {

    await pool.query(
      `
      UPDATE formulas
      SET
        is_active=false,
        updated_at=NOW()
      WHERE id=$1
      `,
      [
        req.params.id
      ]
    );


    res.json({
      ok: true
    });
  }
);


/* =========================================================
   FRONTEND
========================================================= */

app.use(
  express.static(
    frontendPath
  )
);


app.use(
  (req, res) => {

    res.sendFile(
      path.join(
        frontendPath,
        "index.html"
      )
    );

  }
);


/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (
    err,
    req,
    res,
    next
  ) => {

    console.error(err);

    res
      .status(500)
      .json({
        error:
          "Internal server error."
      });
  }
);


/* =========================================================
   START SERVER
========================================================= */

async function startServer() {

  try {

    await ensureDatabaseCompatibility();

    app.listen(PORT, "0.0.0.0", () => {
  console.log(`AWB MATHS HUB running on port ${PORT}`);
});

  } catch (e) {

    console.error(
      "SERVER START FAILED:",
      e
    );

    process.exit(1);
  }
}


startServer();require("dotenv").config();

