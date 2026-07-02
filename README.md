# runlevel-tools

Statische, clientseitige Tool-Sammlung von Runlevel Labs.

Enthalten sind kleine Werkzeuge fuer Wetter, DNS, IP-Check, CIDR-Berechnung, ASN-Lookup und Mail-Security. Die Tools koennen direkt ueber ihre jeweilige `index.html` aufgerufen werden; der Link zur Startseite ist nur eine Navigationhilfe.

## Lokal starten

Die Seiten nutzen JavaScript-Module. Starte sie deshalb ueber einen kleinen Webserver:

```powershell
python -m http.server 8123
```

Danach im Browser oeffnen:

```text
http://127.0.0.1:8123/
```

Einzelne Tools funktionieren auch direkt, zum Beispiel:

```text
http://127.0.0.1:8123/wetter/
```

## Lizenz

MIT License. Siehe [LICENSE](LICENSE).
