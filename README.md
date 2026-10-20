# verbs

![Claude Code at work with verbs: a pixel-art cauldron bubbling over a fire above the spinner line "Brewing…"](.github/verbs.gif)

A Claude Code plugin that plays a looping pixel-art picture above the spinner while Claude works, one for each of the spinner's 188 verbs.

Unofficial, not affiliated with Anthropic.

## Install

```sh
claude plugin marketplace add olliewagner/verbs
claude plugin install verbs@verbs
```

Then restart Claude Code if it is open. The picture plays from the first prompt of the next session.

The website, https://ollie.md/verbs, plays every verb.

## Update

Claude Code updates plugins from other people's marketplaces only where you turn that on: in `/plugin`, open Marketplaces, choose verbs and enable auto-update. To update by hand:

```sh
claude plugin marketplace update verbs
claude plugin update verbs@verbs
```

Then restart Claude Code. Once a day the plugin reads the version published on GitHub and tells you when a newer one is out; it reads nothing while `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is set.

## Uninstall

```sh
claude plugin uninstall verbs@verbs
claude plugin marketplace remove verbs
```

## License

MIT. See `LICENSE`.
