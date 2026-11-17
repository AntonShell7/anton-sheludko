# Personal student portfolio

A small, responsive portfolio for university applications. Built with semantic HTML, CSS, and a little JavaScript. No framework, package installation, build step, backend, database, analytics, or external fonts.

## Run locally

Open a terminal in this `student-portfolio` folder and run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Visit [the local website](http://127.0.0.1:8000). Stop the server with `Ctrl+C`.

You can also open `dist/index.html` directly in a browser. A local server is recommended because it behaves more like a deployed site. Refresh the browser after editing; there is no build process.

## Files

```text
student-portfolio/
├── dist/
│   ├── index.html       All personal details, text, project cards, and links
│   ├── styles.css      Colors, typography, spacing, and responsive layouts
│   ├── script.js       Mobile menu, link activation, current section, and year
│   ├── favicon.svg     Small browser-tab icon
│   └── .nojekyll       Lets GitHub Pages serve these files directly
├── vercel.json         Optional Vercel deployment settings
├── .openai/hosting.json  Private Sites preview identity and static directory
└── README.md
```

`dist` is both the editable source and the folder to publish. Despite the name, nothing generates or overwrites it.

## Make it yours

Edit `dist/index.html`. Search for `PERSONALIZE`, `LINKS`, `PROJECTS`, `ACHIEVEMENTS`, and `EXPERIENCE` to find the relevant comments.

1. Replace `[Your Full Name]`, `[Your Name]`, `[School Name]`, and the other bracketed details. Update the page title, social-sharing title, description, wordmark accessibility label, and footer too.
2. Rewrite the introduction in your own voice. Keep only interests that describe you.
3. Replace the three **example ideas** with your actual projects. Add accurate technologies, your contribution, and the current status. An unfinished project can say “In progress” or “Planned.” Remove cards you do not need.
4. Add only real awards, certificates, schools, programs, and activities. Delete unused rows rather than filling them with invented achievements.
5. Add your contact and project destinations as described below.
6. Once the content is real, remove the project example note and the footer’s `draft-note` paragraph. Check for remaining square brackets before sending the site to universities.

### Add links

Optional anchors intentionally have no `href` until a real destination is supplied. Unset links are readable text, not clickable dead ends. Navigation links work immediately.

For GitHub, LinkedIn, or a project demo, replace the relevant `data-href` value with an absolute `https://` URL:

```html
<a class="quiet-link optional-link" data-href="https://github.com/YOUR_USERNAME">
  GitHub <span class="link-state">not added</span>
</a>
```

The script makes it clickable, replaces “not added” with an arrow, and opens external links in a new tab. Replace every occurrence of `[GitHub URL]` if you want the same profile in both the hero and contact section. Project cards have their own destinations.

For email, replace each `data-email="[Email Address]"` with your address. In the contact section, also replace the visible `[Email Address]` text. The script creates a normal `mailto:` link; there is no contact form or server to configure.

For a résumé, place the PDF at `dist/resume.pdf` and change the résumé anchor to `data-href="./resume.pdf"`. It becomes visible automatically. An absolute HTTPS URL ending in `.pdf` also works. No résumé is included because no real personal information was supplied.

LinkedIn is optional and stays hidden until its `data-href` contains a real URL. You can delete that anchor if you do not use LinkedIn.

All main content and section navigation remain available with JavaScript disabled. Optional contact links are activated by JavaScript.

### Change the design

The color variables are at the top of `dist/styles.css`. The content width is set by `.container`. Mobile layouts begin at `640px`, and tablet adjustments begin at `800px`. The design uses the visitor’s system font and respects reduced-motion preferences.

## Deploy to Vercel

1. Put this `student-portfolio` folder in a Git repository and import that repository into Vercel.
2. Use this folder as the project’s **Root Directory**. If it is the repository root, leave the default root setting.
3. Use **Other** as the framework preset, skip installation and building, and set the output directory to `dist`. The included `vercel.json` supplies these settings.
4. Deploy and visit the URL returned by Vercel.

Static HTML/CSS/JavaScript can be served without a build step. See [Vercel’s build configuration documentation](https://vercel.com/docs/builds/configure-a-build).

## Deploy to GitHub Pages

For the simplest setup, copy the **contents** of `dist` into the root of a separate GitHub repository, including `.nojekyll`. `index.html` should be at the repository root, not inside another `dist` folder.

In **Settings → Pages**, choose **Deploy from a branch**, select your branch (usually `main`), choose **/(root)**, and save. GitHub will display the website URL after deployment. The relative asset paths also work on repository URLs such as `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/`.

GitHub’s branch-based publishing supports the repository root or a `/docs` folder. See [GitHub’s publishing-source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Check before sharing

- Confirm your name, school, dates, and descriptions are accurate.
- Replace or remove every placeholder and example project.
- Open each real project, contact, and PDF link.
- Check the page on your phone and desktop, including the mobile menu.
- Check the browser title and description after personalizing.

The original template contains no claims of completed projects, awards, test scores, employment, or technology proficiency. It is ready to personalize, not ready to submit unchanged as an application portfolio.

## Verification performed

The finished template was served locally and inspected in a real browser at widths of 320, 390, 768, and 1280 pixels. No horizontal overflow was found. Section navigation, the project button, the mobile menu, Escape-to-close with focus return, and back-to-top behavior were checked. Navigation highlighting was checked at the page’s top and contact section. JavaScript syntax, internal anchor targets, local asset references, and JSON configuration checks passed; the browser reported no console errors.

Personal URLs, mail delivery, and a résumé download cannot be verified until you add your own destinations and PDF. Vercel and GitHub Pages instructions are included; deployment to those services was not performed.
