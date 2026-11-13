<?php
namespace Tests\Unit;
use PHPUnit\Framework\TestCase;
use App\Utils\SqlStatements;

class SqlStatementsTest extends TestCase
{
    public function test_quotes_comments_and_procedure_delimiters(): void
    {
        $sql="-- comment ;\nSELECT 'a;b';\nDELIMITER $$\nCREATE PROCEDURE test() BEGIN SELECT 'x;--y'; END $$\nDELIMITER ;\n/* ; */ SELECT 2;";
        $statements=SqlStatements::parse($sql);
        $this->assertCount(3,$statements);
        $this->assertSame("SELECT 'a;b'",$statements[0]);
        $this->assertSame("CREATE PROCEDURE test() BEGIN SELECT 'x;--y'; END",$statements[1]);
        $this->assertSame('SELECT 2',$statements[2]);
    }
    public function test_unclosed_input_is_rejected(): void
    {
        $this->expectException(\RuntimeException::class);
        SqlStatements::parse("SELECT 'broken");
    }
}
