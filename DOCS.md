Gem Scout helps you discover and evaluate early-stage crypto tokens with a risk-first scorecard. It can also keep a watchlist and (optionally) send alerts.

This is informational only and not financial advice. Always do your own research.

Commands
1) /start
What it does: Welcome, short disclaimer, and quick examples.
Usage: /start

2) /help
What it does: Shows all commands and examples.
Usage: /help

3) /gem <query>
What it does: Finds a token by symbol, name, or contract address and returns a structured scorecard.
Usage: /gem PEPE
Usage: /gem 0x...
Notes: If multiple matches are found, the bot will ask which one you mean.

4) /trending [chain]
What it does: Shows a short list of trending/new tokens.
Usage: /trending
Usage: /trending solana
Notes: Use /gem <token> to drill down.

5) /watch add <query>
What it does: Adds a resolved token to your watchlist.
Usage: /watch add PEPE

6) /watch remove <query>
What it does: Removes a token from your watchlist.
Usage: /watch remove PEPE

7) /watch list
What it does: Displays your current watchlist.
Usage: /watch list

8) /alert on | off
What it does: Enables or disables alerts.
Usage: /alert on
Usage: /alert off
Notes: Alerts only run if the server has ALERTS_ENABLED=true.

9) /reset
What it does: Clears your long-term chat memory. You can also clear your watchlist.
Usage: /reset
Usage: /reset all
