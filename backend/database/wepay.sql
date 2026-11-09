CREATE TABLE IF NOT EXISTS usuarios (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telefone VARCHAR(30) NULL,
    senha VARCHAR(255) NOT NULL,
    email_verificado TINYINT(1) NOT NULL DEFAULT 1,
    auth_version INT UNSIGNED NOT NULL DEFAULT 0,
    notificacoes_ativas TINYINT(1) NOT NULL DEFAULT 0,
    sons_notificacoes_ativos TINYINT(1) NOT NULL DEFAULT 1,
    excluido_em DATETIME NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_usuarios_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS grupos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    descricao VARCHAR(500) NULL,
    criado_por BIGINT UNSIGNED NOT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_grupo_criador FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
    INDEX idx_grupos_criador (criado_por),
    INDEX idx_grupos_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS participantes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    grupo_id BIGINT UNSIGNED NOT NULL,
    usuario_id BIGINT UNSIGNED NOT NULL,
    papel ENUM('admin', 'participante') NOT NULL DEFAULT 'participante',
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    removido_em DATETIME NULL,
    CONSTRAINT uq_participante UNIQUE (grupo_id, usuario_id),
    CONSTRAINT fk_participante_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
    CONSTRAINT fk_participante_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_participantes_grupo_ativo (grupo_id, ativo),
    INDEX idx_participantes_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS despesas (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    grupo_id BIGINT UNSIGNED NOT NULL,
    pagador_id BIGINT UNSIGNED NOT NULL,
    criado_por BIGINT UNSIGNED NULL,
    descricao VARCHAR(255) NOT NULL,
    categoria VARCHAR(100) NULL,
    observacao VARCHAR(500) NULL,
    valor DECIMAL(12,2) NOT NULL,
    data_despesa DATE NOT NULL,
    vencimento DATE NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_despesa_valor CHECK (valor > 0),
    CONSTRAINT fk_despesa_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
    CONSTRAINT fk_despesa_pagador FOREIGN KEY (pagador_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT fk_despesa_criador FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_despesas_grupo_data (grupo_id, data_despesa),
    INDEX idx_despesas_criador (criado_por),
    INDEX idx_despesas_vencimento (vencimento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS despesa_divisoes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    despesa_id BIGINT UNSIGNED NOT NULL,
    usuario_id BIGINT UNSIGNED NOT NULL,
    tipo ENUM('igual', 'porcentagem', 'valores') NOT NULL,
    percentual DECIMAL(7,4) NULL,
    valor DECIMAL(12,2) NOT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_despesa_divisao UNIQUE (despesa_id, usuario_id),
    CONSTRAINT fk_divisao_despesa FOREIGN KEY (despesa_id) REFERENCES despesas(id) ON DELETE CASCADE,
    CONSTRAINT fk_divisao_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_divisao_valor CHECK (valor >= 0),
    INDEX idx_divisao_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pagamentos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    grupo_id BIGINT UNSIGNED NOT NULL,
    pagador_id BIGINT UNSIGNED NOT NULL,
    recebedor_id BIGINT UNSIGNED NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    data_pagamento DATE NOT NULL,
    metodo VARCHAR(50) NULL,
    observacao VARCHAR(500) NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_pagamento_valor CHECK (valor > 0),
    CONSTRAINT chk_pagamento_pessoas CHECK (pagador_id <> recebedor_id),
    CONSTRAINT fk_pagamento_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
    CONSTRAINT fk_pagamento_pagador FOREIGN KEY (pagador_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT fk_pagamento_recebedor FOREIGN KEY (recebedor_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    INDEX idx_pagamentos_grupo_data (grupo_id, data_pagamento),
    INDEX idx_pagamentos_pagador (pagador_id),
    INDEX idx_pagamentos_recebedor (recebedor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saldos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    grupo_id BIGINT UNSIGNED NOT NULL,
    usuario_id BIGINT UNSIGNED NOT NULL,
    saldo DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_saldo UNIQUE (grupo_id, usuario_id),
    CONSTRAINT fk_saldo_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
    CONSTRAINT fk_saldo_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_saldos_grupo (grupo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS despesas_pessoais (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id BIGINT UNSIGNED NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    categoria VARCHAR(100) NULL,
    tipo ENUM('despesa', 'receita') NOT NULL DEFAULT 'despesa',
    data_despesa DATE NOT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_pessoal_valor CHECK (valor > 0),
    CONSTRAINT fk_pessoal_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_pessoal_usuario_data (usuario_id, data_despesa),
    INDEX idx_pessoal_usuario_categoria (usuario_id, categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categorias (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id BIGINT UNSIGNED NULL,
    nome VARCHAR(100) NOT NULL,
    tipo ENUM('pessoal', 'grupo', 'ambos') NOT NULL DEFAULT 'ambos',
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_categoria_usuario_nome UNIQUE (usuario_id, nome),
    CONSTRAINT fk_categoria_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_categoria_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gemini_usage_diaria (
    data_utc DATE NOT NULL,
    usuario_id BIGINT UNSIGNED NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    solicitacoes BIGINT UNSIGNED NOT NULL DEFAULT 0,
    bytes_imagem BIGINT UNSIGNED NOT NULL DEFAULT 0,
    alerta_emitido TINYINT(1) NOT NULL DEFAULT 0,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (data_utc, usuario_id, modelo),
    INDEX idx_gemini_usage_model_date (modelo, data_utc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    revogado_em DATETIME NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_refresh_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_refresh_usuario (usuario_id),
    INDEX idx_refresh_expiracao (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS revoked_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    jti CHAR(36) NOT NULL UNIQUE,
    token_type VARCHAR(20) NOT NULL,
    expires_at DATETIME NOT NULL,
    revogado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_revoked_expiracao (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recuperacao_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    usado_em DATETIME NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_recuperacao_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_recuperacao_usuario (usuario_id),
    INDEX idx_recuperacao_expiracao (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS convites_grupo (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    grupo_id BIGINT UNSIGNED NOT NULL,
    email VARCHAR(255) NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    usado_em DATETIME NULL,
    criado_por BIGINT UNSIGNED NOT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_convite_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE,
    CONSTRAINT fk_convite_criador FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE RESTRICT,
    INDEX idx_convite_email (email),
    INDEX idx_convite_grupo (grupo_id),
    INDEX idx_convite_expiracao (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notificacoes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id BIGINT UNSIGNED NOT NULL,
    grupo_id BIGINT UNSIGNED NULL,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    mensagem VARCHAR(500) NOT NULL,
    lida TINYINT(1) NOT NULL DEFAULT 0,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notificacao_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    CONSTRAINT fk_notificacao_grupo FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE SET NULL,
    INDEX idx_notificacao_usuario_lida (usuario_id, lida, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS push_outbox (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    notificacao_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    tentativas SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    disponivel_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reservado_em DATETIME NULL,
    enviado_em DATETIME NULL,
    ultimo_erro VARCHAR(1000) NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_push_outbox_notificacao UNIQUE (notificacao_id),
    CONSTRAINT fk_push_outbox_notificacao
        FOREIGN KEY (notificacao_id) REFERENCES notificacoes(id)
        ON DELETE CASCADE,
    INDEX idx_push_outbox_pendente (status, disponivel_em, id),
    INDEX idx_push_outbox_reserva (status, reservado_em),
    INDEX idx_push_outbox_retencao (status, enviado_em, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS expo_push_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id BIGINT UNSIGNED NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    plataforma ENUM('ios', 'android') NOT NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_expo_push_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_expo_push_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS push_outbox_destinatarios (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    outbox_id BIGINT UNSIGNED NOT NULL,
    expo_push_token_id BIGINT UNSIGNED NULL,
    token VARCHAR(255) NOT NULL,
    status ENUM('pending', 'ticketed', 'provider_accepted', 'failed') NOT NULL DEFAULT 'pending',
    ticket_id VARCHAR(64) NULL,
    receipt_check_at DATETIME NULL,
    receipt_expires_at DATETIME NULL,
    ultimo_erro VARCHAR(1000) NULL,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_push_outbox_destinatario UNIQUE (outbox_id, token),
    CONSTRAINT uq_push_outbox_ticket UNIQUE (ticket_id),
    CONSTRAINT fk_push_destinatario_outbox
        FOREIGN KEY (outbox_id) REFERENCES push_outbox(id) ON DELETE CASCADE,
    CONSTRAINT fk_push_destinatario_token
        FOREIGN KEY (expo_push_token_id) REFERENCES expo_push_tokens(id)
        ON DELETE SET NULL,
    INDEX idx_push_destinatario_status (outbox_id, status, receipt_check_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
