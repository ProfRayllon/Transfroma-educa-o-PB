# -*- coding: utf-8 -*-
"""
Reduz as tres imagens da capa.

Elas chegaram com 1086x1448 e ~1,3 MB cada -- 3,9 MB numa pagina so, servidos de
uma VPS de 957 MB. No maior tamanho de tela o cartao ocupa cerca de 530 px de
largura, entao 1060 px ja cobre tela de alta densidade com folga.

Gera WebP ao lado do PNG. O PNG original vira o reserva de quem nao aceita WebP
-- que hoje e quase ninguem, mas o <picture> resolve isso de graca.
"""
import os
from PIL import Image

# Relativo a este arquivo: o script roda de qualquer lugar.
pasta = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'images', 'painel')
LARGURA = 1060

for nome in ('concluintes', 'progresso', 'sistema'):
    origem = os.path.join(pasta, nome + '.png')
    if not os.path.exists(origem):
        print('faltando: ' + nome); continue

    im = Image.open(origem).convert('RGBA')
    antes_px = im.size
    antes_kb = os.path.getsize(origem) / 1024

    if im.width > LARGURA:
        altura = round(im.height * LARGURA / im.width)
        im = im.resize((LARGURA, altura), Image.LANCZOS)

    # PNG enxuto: a paleta nao serve (sao degrades), entao so recomprime.
    im.save(origem, 'PNG', optimize=True)
    png_kb = os.path.getsize(origem) / 1024

    destino_webp = os.path.join(pasta, nome + '.webp')
    im.save(destino_webp, 'WEBP', quality=86, method=6)
    webp_kb = os.path.getsize(destino_webp) / 1024

    print('%-14s %sx%s %.0f KB  ->  %sx%s   png %.0f KB   webp %.0f KB'
          % (nome, antes_px[0], antes_px[1], antes_kb, im.width, im.height, png_kb, webp_kb))
