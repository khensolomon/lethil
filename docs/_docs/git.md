---
title: "Git"
description: "Everyday git commands, setup, and recovering from mistakes."
group: "Reference"
category: "Guide"
nav_order: 50
tags: [tooling, cli]
---

git archive processes the repository locally before pushing to GitHub

```bash
cd project
git archive --format=zip HEAD -o ~/Downloads/test-export.zip
```

## .gitattributes

```bash
# Using spaces (most common)
.gitignore export-ignore

# Using tabs
.gitignore export-ignore
```

## Repository

```bash
git clone git@github.com:<owner>/<repo>.git
```

## First-time setup

```bash
sudo apt install git -y

git config --global user.name "Name"
git config --global user.email "name@domain.com"
git config --list
```

Key generation is in [[Remote access]].

## Commits

```bash
git status
git add .
git commit -m "Subject" -m "Description"

# Closes issues from the message: close, closes, closed,
# fix, fixes, fixed, resolve, resolves, resolved
git commit -m "example of coding - close #1 close #2"
```

## Fixing things

```bash
# Undo the last commit, keep the changes staged
git reset --soft HEAD~1

# Which config set this email, and what did the last commit use
git config --local user.email
git config --show-origin user.email
git log -1 --pretty=fuller
```

Push rejected for email privacy: take the `noreply` address from
<https://github.com/settings/emails>, then

```bash
git config --global user.email "<id>+<username>@users.noreply.github.com"
git commit --amend --reset-author --no-edit
git push origin master
```

## Renamed default branch

```bash
git branch -m main make
git fetch origin
git branch -u origin/make make
git remote set-head origin -a
```
