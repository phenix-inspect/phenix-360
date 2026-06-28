# Conftest à la racine du package gateway : pytest insère ce dossier dans
# sys.path (mode import "prepend"), rendant le package `app` importable par les
# tests sans installation.
