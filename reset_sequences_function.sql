-- =====================================================
-- PostgreSQL Function: Reset All Sequences to Max
-- Resets all sequences to the maximum value of their corresponding table columns
-- Useful when manually inserting data with specific IDs
-- =====================================================

-- Create function to reset all sequences
CREATE OR REPLACE FUNCTION reset_all_sequences()
RETURNS TABLE(
    sequence_name TEXT,
    table_name TEXT,
    column_name TEXT,
    old_value BIGINT,
    new_value BIGINT
) AS $$
DECLARE
    seq_record RECORD;
    table_schema_name TEXT;
    table_name_var TEXT;
    column_name_var TEXT;
    max_val BIGINT;
    current_val BIGINT;
    sql_query TEXT;
BEGIN
    -- Loop through all sequences in public schema
    FOR seq_record IN
        SELECT 
            schemaname,
            sequencename,
            -- Extract table name from sequence name (assuming format: tablename_columnname_seq)
            regexp_replace(sequencename, '_id_seq$|_seq$', '', 'g') as possible_table_name
        FROM pg_sequences
        WHERE schemaname = 'public'
    LOOP
        -- Try to find the table and column for this sequence
        -- Most sequences follow pattern: tablename_columnname_seq
        table_name_var := seq_record.possible_table_name;
        
        -- Try to find the column that uses this sequence
        SELECT 
            t.table_name,
            c.column_name,
            t.table_schema
        INTO table_name_var, column_name_var, table_schema_name
        FROM information_schema.columns c
        JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
        WHERE c.table_schema = 'public'
        AND c.column_default LIKE '%' || seq_record.sequencename || '%'
        LIMIT 1;
        
        -- If we found a matching table and column
        IF table_name_var IS NOT NULL AND column_name_var IS NOT NULL THEN
            -- Get current sequence value
            EXECUTE format('SELECT last_value FROM %I.%I', seq_record.schemaname, seq_record.sequencename) INTO current_val;
            
            -- Get max value from table column
            sql_query := format('SELECT COALESCE(MAX(%I), 0) FROM %I.%I', 
                column_name_var, 
                table_schema_name, 
                table_name_var
            );
            EXECUTE sql_query INTO max_val;
            
            -- Reset sequence to max value (or max + 1 to be safe)
            -- Set the sequence to max_val + 1 so next insert gets max_val + 1
            EXECUTE format('SELECT setval(%L, %s, true)', 
                seq_record.schemaname || '.' || seq_record.sequencename,
                GREATEST(max_val, current_val) + 1
            );
            
            -- Return information
            sequence_name := seq_record.schemaname || '.' || seq_record.sequencename;
            table_name := table_name_var;
            column_name := column_name_var;
            old_value := current_val;
            new_value := GREATEST(max_val, current_val) + 1;
            
            RETURN NEXT;
        END IF;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Usage Examples
-- =====================================================

-- Reset all sequences and see results
-- SELECT * FROM reset_all_sequences();

-- =====================================================
-- Grant execute permissions (if needed)
-- =====================================================

-- GRANT EXECUTE ON FUNCTION reset_all_sequences() TO your_user;
